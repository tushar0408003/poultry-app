export interface JwtPayload {
  sub: string;
  ver: number;
}

export interface AuthUser {
  id: string;
  username: string;
}
