import { route } from "@/app/api/v1/_lib/route";

const SWAGGER = "5.17.14";

/** Swagger UI at /api/v1/docs, reading /api/v1/openapi.json. */
export const GET = route(async () =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NearPaw API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER}/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@${SWAGGER}/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/api/v1/openapi.json",dom_id:"#ui",persistAuthorization:true,tryItOutEnabled:true})</script>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  ),
);
