export interface JwtPayload {
  sub: string;
  username: string;
  ver: number;
}

export interface AuthUser {
  id: string;
  username: string;
}
