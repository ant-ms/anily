import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "https://graphql.anilist.co",
  documents: ["lib/**/*.ts"],
  generates: {
    "src/gql/": {
      preset: "client",
      plugins: [],
    },
  },
};

export default config;
