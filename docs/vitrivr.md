# Short Vitrivr Setup Guide 

## 1. Create the schema configuration
Follow the [official vitrivr documentation](https://github.com/vitrivr) to create your `schema.json`.

## 2. Start PostgreSQL
If PostgreSQL is not already running (for example, if you are not using Docker), start with

    ```bash
    sudo systemctl start postgresql

## 3. Initialize schema 
    ```bash
    {schema} init

## 4. Query System
Can be either done with this frontend (that is still work in progess) or with the swagger-ui: http://localhost:7070/swagger-ui

# Generating the OpenAPI files: 
    ´´´bash
    npx openapi-typescript-codegen   --input openapi.json   --output src/api   --client fetch   --name VitrivrApi
We don't recommend using the automated tool from Webstorm, as this produces faulty files. In case you don't have the 
openapi.json file for the generation you can simply copy it from http://localhost:7070/swagger-ui .
Most likely you will be running into issues with erasableSyntax (Error: This syntax is not allowed when erasableSyntaxOnly is enabled.)
To fix this issue convert the parameter property into a field. There should be a QuickFix option in tools like webstorm
for this issue.