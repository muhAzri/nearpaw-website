export interface Page<T> {
  readonly items: T[];
  readonly total: number;
}
