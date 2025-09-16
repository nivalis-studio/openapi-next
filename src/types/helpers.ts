// Ref: https://twitter.com/diegohaz/status/1524257274012876801
export type StringWithAutocomplete<T> =
	| T
	| (string & { [key in never]: never });

export type AnyCase<T extends string> = T | Uppercase<T> | Lowercase<T>;
export type Modify<T, R> = Omit<T, keyof R> & R;
