import transform from "../../dataplan-pg/__tests__/transform-graphql.js";

export default {
  process: transform.makeProcess({
    includeDeoptimize: false,
    // TODO: change includeStringified to 'true'
    includeStringified: false,
  }),
};
