import type { OpenAPIV3_1 as OpenAPI } from "openapi-types";
import type { Modify } from "./helpers";

export type OpenApiPathItem = Partial<
	Pick<
		OpenAPI.PathItemObject,
		"summary" | "description" | "servers" | "parameters"
	>
>;

export type OpenApiOperation = Partial<
	Pick<
		OpenAPI.OperationObject,
		| "tags"
		| "summary"
		| "description"
		| "externalDocs"
		| "parameters"
		| "callbacks"
		| "deprecated"
		| "security"
		| "servers"
	>
>;

export type OpenApiObject = Partial<
	Modify<
		Omit<OpenAPI.Document, "openapi">,
		{
			info: Partial<OpenAPI.InfoObject>;
		}
	>
>;

export type NrfOasData = {
	paths?: OpenAPI.PathsObject;
	schemas?: { [key: string]: OpenAPI.SchemaObject };
};
