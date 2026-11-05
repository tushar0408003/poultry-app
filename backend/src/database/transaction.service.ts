import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { ClientSession, Connection } from 'mongoose';
import { flag, isProduction } from '../config/env.validation';

/**
 * Runs multi-document writes atomically.
 *
 * MongoDB transactions need a replica set (or sharded cluster). On a standalone
 * server we fall back to running the same work without a session and log a
 * warning at startup. Services validate everything *before* writing, so the
 * fallback only loses atomicity if the process dies mid-operation.
 */
@Injectable()
export class TransactionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TransactionService.name);
  private supported = false;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const db = this.connection.db;
    if (!db) return;
    const hello = await db.admin().command({ hello: 1 });
    this.supported = Boolean(hello.setName) || hello.msg === 'isdbgrid';
    if (this.supported) {
      this.logger.log(`MongoDB transactions enabled (replica set "${hello.setName ?? 'mongos'}")`);
    } else if (flag(this.config, 'REQUIRE_TRANSACTIONS', isProduction(this.config))) {
      throw new Error(
        'MongoDB transactions are required (REQUIRE_TRANSACTIONS) but the server is standalone. ' +
          'Run MongoDB as a replica set (see README) or set REQUIRE_TRANSACTIONS=false.',
      );
    } else {
      this.logger.warn(
        'MongoDB is running standalone: transactions are DISABLED. ' +
          'Convert it to a single-node replica set for full atomicity (see README).',
      );
    }
  }

  get transactionsSupported(): boolean {
    return this.supported;
  }

  async run<T>(work: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
    if (!this.supported) return work(undefined);
    const session = await this.connection.startSession();
    try {
      // withTransaction retries the callback on transient errors (e.g. write
      // conflicts from concurrent payments), re-running every read and check.
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }
}
