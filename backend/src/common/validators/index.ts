import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min, registerDecorator, ValidationOptions } from 'class-validator';
import { isValidDateOnly } from '../dates';

/** A calendar date in "YYYY-MM-DD" form. */
export function IsDateOnly(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName,
      options: { message: `${propertyName} must be a valid date in YYYY-MM-DD format`, ...options },
      validator: { validate: (value: unknown) => isValidDateOnly(value) },
    });
  };
}

/** Upper bounds keep every value far inside the safe-integer range after conversion. */
const MAX_RUPEES = 1_000_000_000; // ₹100 crore
const MAX_KG = 1_000_000; // 1,000 tonnes

/** Rupee amount: number, >= min, at most 2 decimal places. */
export function IsRupees(min = 0) {
  return applyDecorators(
    Type(() => Number),
    IsNumber(
      { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
      { message: '$property must be a number with at most 2 decimal places' },
    ),
    Min(min),
    Max(MAX_RUPEES),
  );
}

/** Weight in KG: number, >= min, at most 3 decimal places (grams). */
export function IsKg(min = 0) {
  return applyDecorators(
    Type(() => Number),
    IsNumber(
      { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 },
      { message: '$property must be a number with at most 3 decimal places' },
    ),
    Min(min),
    Max(MAX_KG),
  );
}
