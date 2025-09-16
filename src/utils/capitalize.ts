export const capitalizeFirstLetter = (str: string) =>
	// eslint-disable-next-line no-unsafe-optional-chaining
	str[0]?.toUpperCase() + str.slice(1);
