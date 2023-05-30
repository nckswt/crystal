import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputType,
} from "graphql";
import * as graphql from "graphql";

import type { OperationPlan } from "./engine/OperationPlan.js";
import { __InputObjectStep, __TrackedValueStep } from "./index.js";
import { BaseStep } from "./index.js";
import type { InputStep } from "./input.js";
import type {
  FieldArgs,
  InputObjectTypeInputPlanResolver,
  TargetStepOrCallback,
  TrackedArguments,
} from "./interfaces.js";
import type { ModifierStep } from "./step.js";
import { assertExecutableStep, ExecutableStep } from "./step.js";
import type { __ItemStep } from "./steps/__item.js";
import { constant, ConstantStep } from "./steps/constant.js";
import { list } from "./steps/list.js";
import { object } from "./steps/object.js";

const {
  getNullableType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isScalarType,
} = graphql;

export type ApplyAfterModeArg =
  | "autoApplyAfterParentPlan"
  | "autoApplyAfterParentSubscribePlan";
type ApplyAfterModeInput =
  | "autoApplyAfterParentApplyPlan"
  | "autoApplyAfterParentInputPlan";
type ApplyAfterMode = ApplyAfterModeArg | ApplyAfterModeInput;

export function withFieldArgsForArguments<
  T extends ExecutableStep,
  TParentStep extends ExecutableStep = ExecutableStep,
>(
  operationPlan: OperationPlan,
  $parent: TParentStep,
  $all: TrackedArguments,
  field: GraphQLField<any, any, any>,
  applyAfterMode: ApplyAfterModeArg,
  callback: (fieldArgs: FieldArgs) => T | null | undefined,
): Exclude<T, undefined | null> | null {
  if (operationPlan.loc !== null)
    operationPlan.loc.push(`withFieldArgsForArguments(${field.name})`);

  const schema = operationPlan.schema;

  const args: {
    [key: string]: GraphQLArgument;
  } = Object.create(null);
  for (const arg of field.args) {
    args[arg.name] = arg;
  }

  const got = new Map<string, ExecutableStep>();
  const applied = new Map<string, ExecutableStep>();

  const fieldArgs: FieldArgs = {
    getRaw(path) {
      if (typeof path === "string") {
        return $all.get(path);
      } else if (Array.isArray(path)) {
        const [first, ...rest] = path;
        if (!first) {
          throw new Error(`getRaw must be called with a non-empty path`);
        }
        let $entry = $all.get(first);
        for (const pathSegment of rest) {
          if ("get" in $entry) {
            $entry = $entry.get(pathSegment);
          } else {
            throw new Error(
              `'getRaw' path must only relate to input objects right now; path was: '${path}' (failed at '${pathSegment}')`,
            );
          }
        }
        return $entry;
      } else {
        throw new Error(`Invalid path`);
      }
    },
    get(inPath) {
      const path = Array.isArray(inPath) ? inPath : inPath ? [inPath] : [];
      const pathString = path.join(".");
      const $existing = got.get(pathString);
      if ($existing) {
        return $existing;
      }
      if (path.length === 0) {
        throw new Error(`get() must be called with a non-empty path`);
      } else {
        const [argName, ...rest] = path;
        let entity: GraphQLArgument | GraphQLInputField = args[argName];
        if (!entity) {
          throw new Error(`Invalid path; argument '${argName}' does not exist`);
        }
        let $val = $all.get(argName);
        for (const pathSegment of rest) {
          const nullableType: graphql.GraphQLNullableType & GraphQLInputType =
            getNullableType(entity.type);
          if (isInputObjectType(nullableType)) {
            entity = nullableType.getFields()[pathSegment];
            if ("get" in $val) {
              $val = $val.get(pathSegment);
            } else {
              throw new Error(
                `GrafastInternalError<b9e9a57a-bbdd-486c-bdcf-25cf99bf0243>: Processing input object type, but '${$val}' has no .get() method.`,
              );
            }
          } else {
            throw new Error(`Can't pass non-object boundary`);
          }
        }
        let result;
        const childFieldArgs = getFieldArgsForPath(path, entity, $val, "input");
        if (rest.length === 0) {
          // Argument
          const arg = entity as GraphQLArgument;
          result = arg.extensions.grafast?.inputPlan
            ? arg.extensions.grafast.inputPlan($parent, childFieldArgs, {
                schema,
                entity: arg,
              })
            : $val;
        } else {
          // input field
          const inputField = entity as GraphQLInputField;
          result = inputField.extensions.grafast?.inputPlan
            ? inputField.extensions.grafast.inputPlan(childFieldArgs, {
                schema,
                entity: inputField,
              })
            : $val;
        }
        const nullableType = getNullableType(entity.type);
        if (isInputObjectType(nullableType)) {
          processAfter(
            fieldArgs,
            path,
            result,
            nullableType.getFields(),
            "autoApplyAfterParentInputPlan",
          );
        }
        return result;
      }
    },
    apply($target, inPath) {
      const path = Array.isArray(inPath) ? inPath : inPath ? [inPath] : [];
      const pathString = path.join(".");
      const $existing = applied.get(pathString);
      if ($existing) {
        throw new Error(
          `Attempted to apply 'applyPlan' at input path ${pathString} more than once - first time to ${$existing}, second time to ${$target}. Multiple applications are not currently supported.`,
        );
      }
      if (path.length === 0) {
        throw new Error(`apply() must be called with a non-empty path`);
      } else {
        const [argName, ...rest] = path;
        let entity: GraphQLArgument | GraphQLInputField = args[argName];
        if (!entity) {
          throw new Error(`Invalid path; argument '${argName}' does not exist`);
        }
        let $val = $all.get(argName);
        for (const pathSegment of rest) {
          const nullableType: graphql.GraphQLNullableType & GraphQLInputType =
            getNullableType(entity.type);
          if (isInputObjectType(nullableType)) {
            entity = nullableType.getFields()[pathSegment];
            if ("get" in $val) {
              $val = $val.get(pathSegment);
            } else {
              throw new Error(
                `GrafastInternalError<b9e9a57a-bbdd-486c-bdcf-25cf99bf0243>: Processing input object type, but '${$val}' has no .get() method.`,
              );
            }
          } else {
            throw new Error(`Can't pass non-object boundary`);
          }
        }
        if (notUndefined($val)) {
          const childFieldArgs = getFieldArgsForPath(
            path,
            entity,
            $val,
            "apply",
          );
          operationPlan.withModifiers(() => {
            let result;
            if (rest.length === 0) {
              // Argument
              const arg = entity as GraphQLArgument;
              result = arg.extensions.grafast?.applyPlan
                ? arg.extensions.grafast.applyPlan(
                    $parent,
                    $target,
                    childFieldArgs,
                    {
                      schema,
                      entity: arg,
                    },
                  )
                : $val;
            } else {
              // input field
              const inputField = entity as GraphQLInputField;
              result = inputField.extensions.grafast?.applyPlan
                ? inputField.extensions.grafast.applyPlan(
                    $target,
                    childFieldArgs,
                    {
                      schema,
                      entity: inputField,
                    },
                  )
                : $val;
            }
            const nullableType = getNullableType(entity.type);
            if (isInputObjectType(nullableType)) {
              processAfter(
                fieldArgs,
                path,
                result ?? $target,
                nullableType.getFields(),
                "autoApplyAfterParentApplyPlan",
              );
            }
          });
        }
      }
    },
  };
  for (const argName of Object.keys(args)) {
    // TODO: remove the 'any'
    (fieldArgs as any)[`$${argName}`] = fieldArgs.getRaw(argName);
  }

  function getFieldArgsForPath(
    path: string[],
    entity: GraphQLArgument | GraphQLInputField,
    $input: InputStep,
    mode: "input" | "apply",
  ): FieldArgs {
    const localFieldArgs: FieldArgs = {
      getRaw(subpath) {
        return fieldArgs.getRaw(concatPath(path, subpath));
      },
      get(subpath) {
        if (!subpath || (Array.isArray(subpath) && subpath.length === 1)) {
          // TODO: handle list inputs here!
          throw new Error(
            `Call to fieldArgs.get() at input path ${path.join(
              ".",
            )} must pass a non-empty subpath`,
          );
        }
        return fieldArgs.get(concatPath(path, subpath));
      },
      apply($target, subpath) {
        if (
          mode === "apply" &&
          (!subpath || (Array.isArray(subpath) && subpath.length === 1))
        ) {
          // TODO: handle list inputs here!
          throw new Error(
            `Call to fieldArgs.apply() from 'applyPlan' at input path ${path.join(
              ".",
            )} must pass a non-empty subpath`,
          );
        }
        return fieldArgs.apply($target, concatPath(path, subpath));
      },
    };

    const nullableEntityType = getNullableType(entity.type);
    if (isInputObjectType(nullableEntityType)) {
      const inputFields = nullableEntityType.getFields();
      for (const fieldName of Object.keys(inputFields)) {
        if ("get" in $input) {
          // TODO: remove the 'any'
          (localFieldArgs as any)[`$${fieldName}`] = $input.get(fieldName);
        } else {
          throw new Error(
            `GrafastInternalError<9b70d5c0-c45f-4acd-8b94-eaa02f87ad41>: expected '${$input}' to have a .get() method`,
          );
        }
      }
    }

    return localFieldArgs;
  }

  const result = callback(fieldArgs);

  processAfter(fieldArgs, [], result, args, applyAfterMode);

  if (operationPlan.loc !== null) operationPlan.loc.pop();

  return (result ?? null) as Exclude<T, null | undefined> | null;
}

function processAfter(
  rootFieldArgs: FieldArgs,
  path: readonly string[],
  result: ExecutableStep | ModifierStep | null | undefined,
  fields: Record<string, GraphQLArgument | GraphQLInputField>,
  applyAfterMode: ApplyAfterMode,
) {
  if (result != null && !(result instanceof ConstantStep && result.isNull())) {
    if (applyAfterMode === "autoApplyAfterParentApplyPlan" && result != null) {
      // `applyPlan` returned a step, so auto-apply every subfield to it
      for (const name of Object.keys(fields)) {
        rootFieldArgs.apply(result, [...path, name]);
      }
    } else {
      for (const [name, spec] of Object.entries(fields)) {
        const autoApply =
          applyAfterMode === "autoApplyAfterParentPlan"
            ? (spec as GraphQLArgument).extensions.grafast
                ?.autoApplyAfterParentPlan
            : applyAfterMode === "autoApplyAfterParentSubscribePlan"
            ? (spec as GraphQLArgument).extensions.grafast
                ?.autoApplyAfterParentSubscribePlan
            : applyAfterMode === "autoApplyAfterParentInputPlan"
            ? (spec as GraphQLInputField).extensions.grafast
                ?.autoApplyAfterParentInputPlan
            : applyAfterMode === "autoApplyAfterParentApplyPlan"
            ? (spec as GraphQLInputField).extensions.grafast
                ?.autoApplyAfterParentApplyPlan
            : null;
        if (autoApply) {
          rootFieldArgs.apply(result, [...path, name]);
        }
      }
    }
  }
}

function concatPath(
  path: readonly string[],
  subpath: readonly string[] | string | undefined,
) {
  const localPath = Array.isArray(subpath) ? subpath : subpath ? [subpath] : [];
  return [...path, ...localPath];
}

function notUndefined($value: InputStep) {
  // OPTIMIZE: having a lot of 'is undefined' checks is expensive; instead we
  // should optimize this so that it tracks the set of keys that are set and
  // matches against those as a single operation.
  return !("evalIs" in $value && $value.evalIs(undefined));
}
