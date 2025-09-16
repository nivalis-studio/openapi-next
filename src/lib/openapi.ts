/* eslint-disable max-statements */
import { merge } from "es-toolkit/compat";
import type { OpenAPIV3_1 as OpenAPI } from "openapi-types";
import type { ZodObject, ZodRawShape, z } from "zod";
import type {
	NrfOasData,
	OpenApiOperation,
	OpenApiPathItem,
} from "../types/open-api";
import type { RouteOperationDefinition } from "../types/operation";
import { capitalizeFirstLetter } from "../utils/capitalize";
import type { HttpMethod } from "./http";
import {
	ERROR_MESSAGE_SCHEMA,
	UNEXPECTED_ERROR_RESPONSE,
} from "./openapi-errors";
import type { ToJsonOptions } from "./zod";
import { getJsonSchema } from "./zod";

const isSchemaRef = (
	schema: OpenAPI.SchemaObject | OpenAPI.ReferenceObject,
): schema is OpenAPI.ReferenceObject =>
	typeof schema === "object" && "$ref" in schema;

export const getPathsFromRoute = ({
	method: method_,
	operationId,
	operation,
	routeName,
	openApiPath,
	openApiOperation,
	zodToJsonOptions,
}: {
	method: HttpMethod;
	operationId: string;
	operation: RouteOperationDefinition;
	routeName: string;
	openApiPath?: OpenApiPathItem;
	openApiOperation?: OpenApiOperation;
	zodToJsonOptions?: ToJsonOptions;
}): NrfOasData => {
	const paths: OpenAPI.PathsObject = {};
	const method = method_.toLowerCase();

	const requestBodySchemas: {
		[key: string]: {
			key: string;
			ref: string;
			schema: OpenAPI.SchemaObject;
		};
	} = {};

	const responseBodySchemas: {
		[key: string]: Array<{
			key: string;
			ref: string;
			schema: OpenAPI.SchemaObject;
		}>;
	} = {};

	const baseResponseBodySchemaMapping: {
		[key: string]: OpenAPI.SchemaObject;
	} = {
		ErrorMessage: ERROR_MESSAGE_SCHEMA,
	};

	const generatedOperationObject: OpenAPI.OperationObject = {
		operationId,
	};

	const { input, outputs } = operation;

	if (input?.body && input?.contentType) {
		const key = `${capitalizeFirstLetter(operationId)}RequestBody`;

		const schema = getJsonSchema({
			schema: input.body,
			operationId,
			type: "input-body",
			zodToJsonOptions,
		});

		const ref = isSchemaRef(schema)
			? schema.$ref
			: `#/components/schemas/${key}`;

		if (!isSchemaRef(schema)) {
			requestBodySchemas[method] = {
				key,
				ref,
				schema,
			};
		}

		generatedOperationObject.requestBody = {
			content: {
				[input.contentType]: {
					schema: {
						$ref: ref,
					},
				},
			},
		};

		const description = input.body.description;

		if (description) {
			generatedOperationObject.requestBody.description = description;
		}
	}

	const usedStatusCodes: number[] = [];

	const baseOperationResponses: OpenAPI.ResponsesObject = {
		500: UNEXPECTED_ERROR_RESPONSE,
	};

	generatedOperationObject.responses = outputs?.reduce(
		(obj, { status, contentType, body, name }) => {
			const occurrenceOfStatusCode = usedStatusCodes.includes(status)
				? usedStatusCodes.filter((sts) => sts === status).length + 1
				: "";

			const key =
				name ??
				`${capitalizeFirstLetter(
					operationId,
				)}${status}ResponseBody${occurrenceOfStatusCode}`;

			usedStatusCodes.push(status);

			const schema = getJsonSchema({
				schema: body,
				operationId,
				type: "output-body",
				zodToJsonOptions,
			});

			const ref = isSchemaRef(schema)
				? schema.$ref
				: `#/components/schemas/${key}`;

			if (!isSchemaRef(schema)) {
				responseBodySchemas[method] = [
					...(responseBodySchemas[method] ?? []),
					{
						key,
						ref,
						schema,
					},
				];
			}

			const description = body.description ?? `Response for status ${status}`;

			return Object.assign(obj, {
				[status]: {
					description,
					content: {
						[contentType]: {
							schema: {
								$ref: ref,
							},
						},
					},
				},
			});
		},
		baseOperationResponses,
	);

	let pathParameters: OpenAPI.ParameterObject[] = [];

	if (input?.params) {
		const schema =
			getJsonSchema({
				schema: input.params,
				operationId,
				type: "input-params",
			}).properties ?? {};

		pathParameters = Object.entries(schema).map(([name, schema_]) => {
			const schema__ = (input.params as ZodObject<ZodRawShape>).shape[
				name
			] as z.ZodType;

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			return {
				name,
				in: "path",
				required: !schema__.isOptional(),

				schema: schema_,
			} as OpenAPI.ParameterObject;
		});

		generatedOperationObject.parameters = [
			...(generatedOperationObject.parameters ?? []),
			...pathParameters,
		];
	}

	const automaticPathParameters = routeName
		// eslint-disable-next-line regexp/no-unused-capturing-group, sonarjs/slow-regex
		.match(/\{([^}]+)\}/g)
		?.map((param) => param.replaceAll(/[{}]/g, ""))
		// Filter out path parameters that have been explicitly defined.
		.filter((_name) => !pathParameters?.some(({ name }) => name === _name));

	if (automaticPathParameters?.length) {
		generatedOperationObject.parameters = [
			...(generatedOperationObject.parameters ?? []),
			...(automaticPathParameters.map((name) => ({
				name,
				in: "path",
				required: true,
				schema: { type: "string" },
			})) as OpenAPI.ParameterObject[]),
		];
	}

	if (input?.query) {
		const schema =
			getJsonSchema({
				schema: input.query,
				operationId,
				type: "input-query",
			}).properties ?? {};

		generatedOperationObject.parameters = [
			...(generatedOperationObject.parameters ?? []),
			...Object.entries(schema).map(([name, schema_]) => {
				const schema__ = (input.query as ZodObject<ZodRawShape>).shape[
					name
				] as z.ZodType;

				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				return {
					name,
					in: "query",
					required: !schema__.isOptional(),

					schema: schema_,
				} as OpenAPI.ParameterObject;
			}),
		];
	}

	paths[routeName] = {
		...openApiPath,
		[method]: merge(generatedOperationObject, openApiOperation),
	};

	const requestBodySchemaMapping = Object.values(requestBodySchemas).reduce<{
		[key: string]: OpenAPI.SchemaObject;
	}>((acc, { key, schema }) => {
		// eslint-disable-next-line no-param-reassign
		acc[key] = schema;

		return acc;
	}, {});

	const responseBodySchemaMapping = Object.values(responseBodySchemas)
		.flat()
		.reduce<{ [key: string]: OpenAPI.SchemaObject }>((acc, { key, schema }) => {
			// eslint-disable-next-line no-param-reassign
			acc[key] = schema;

			return acc;
		}, baseResponseBodySchemaMapping);

	const schemas: { [key: string]: OpenAPI.SchemaObject } = {
		...requestBodySchemaMapping,
		...responseBodySchemaMapping,
	};

	return { paths, schemas };
};
