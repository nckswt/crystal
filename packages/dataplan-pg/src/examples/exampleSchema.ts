/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
import { jsonParse, JSONParsePlan } from "@dataplan/json";
import * as crypto from "crypto";
import { writeFileSync } from "fs";
import type {
  __TrackedObjectPlan,
  AccessPlan,
  BaseGraphQLContext,
  BaseGraphQLRootValue,
  CrystalSubscriber,
  EachPlan,
  ExecutablePlan,
  InputObjectPlan,
  InputStaticLeafPlan,
} from "graphile-crystal";
import {
  __ValuePlan,
  aether,
  BasePlan,
  constant,
  context,
  crystalEnforce,
  each,
  lambda,
  list,
  ModifierPlan,
  newGraphileFieldConfigBuilder,
  newInputObjectTypeBuilder,
  newObjectTypeBuilder,
  object,
  resolveType,
  subscribe,
} from "graphile-crystal";
import { EXPORTABLE } from "graphile-exporter";
import type { GraphQLOutputType } from "graphql";
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLUnionType,
  printSchema,
} from "graphql";
import type { SQL } from "pg-sql2";
import sql from "pg-sql2";
//import prettier from "prettier";
import { inspect } from "util";

import type {
  PgConditionCapableParentPlan,
  PgExecutorContextPlans,
  PgInsertPlan,
  PgSelectPlan,
  PgSourceColumn,
  PgSourceColumnVia,
  PgSourceRelation,
  PgSubscriber,
  PgTypeCodec,
  WithPgClient,
} from "../../src";
import {
  enumType,
  pgClassExpression,
  PgClassExpressionPlan,
  PgConditionPlan,
  PgConnectionPlan,
  pgDelete,
  PgDeletePlan,
  PgEnumSource,
  PgExecutor,
  pgInsert,
  pgPolymorphic,
  pgSelect,
  pgSelectSingleFromRecord,
  PgSelectSinglePlan,
  pgSingleTablePolymorphic,
  PgSource,
  PgSourceBuilder,
  pgUpdate,
  PgUpdatePlan,
  recordType,
  TYPES,
} from "../../src";

declare module "../../src" {
  interface PgEnumSourceExtensions {
    tableSource?: PgSource<any, any, any, any, any>;
  }
}

// These are what the generics extend from

// This is the actual runtime context; we should not use a global for this.
export interface OurGraphQLContext extends BaseGraphQLContext {
  pgSettings: { [key: string]: string };
  withPgClient: WithPgClient;
  pgSubscriber: PgSubscriber;
}

/*+--------------------------------------------------------------------------+
  |                               DATA SOURCES                               |
  +--------------------------------------------------------------------------+*/

/**
 * Expand this interface with your own types.
 */
export interface GraphQLTypeFromPostgresType {
  text: string;
  citext: string;
  uuid: string;
  timestamptz: string;
  int: number;
  float: number;
  boolean: boolean;
}

type NullableUnless<
  TCondition extends boolean | undefined,
  TType,
> = TCondition extends true ? TType : TType | null | undefined;

export function makeExampleSchema(
  options: { deoptimize?: boolean } = Object.create(null),
): GraphQLSchema {
  const deoptimizeIfAppropriate = EXPORTABLE(
    (options) => (plan: PgSelectPlan<any> | PgSelectSinglePlan<any>) => {
      if (options.deoptimize) {
        if ("getClassPlan" in plan) {
          plan.getClassPlan().setInliningForbidden();
        } else {
          plan.setInliningForbidden();
        }
      }
      return plan;
    },
    [options],
  );
  // type MessagesPlan = PgSelectPlan<typeof messageSource>;
  type MessageConnectionPlan = PgConnectionPlan<typeof messageSource>;
  type MessagePlan = PgSelectSinglePlan<typeof messageSource>;
  // type UsersPlan = PgSelectPlan<typeof userSource>;
  type UserPlan = PgSelectSinglePlan<typeof userSource>;
  // type ForumsPlan = PgSelectPlan<typeof forumSource>;
  type ForumPlan = PgSelectSinglePlan<typeof forumSource>;
  type PersonPlan = PgSelectSinglePlan<typeof personSource>;
  type PersonBookmarkPlan = PgSelectSinglePlan<typeof personBookmarksSource>;
  type PostPlan = PgSelectSinglePlan<typeof postSource>;
  type CommentPlan = PgSelectSinglePlan<typeof commentSource>;
  type SingleTableItemsPlan = PgSelectPlan<typeof singleTableItemsSource>;
  type SingleTableItemPlan = PgSelectSinglePlan<typeof singleTableItemsSource>;
  type RelationalItemsPlan = PgSelectPlan<typeof relationalItemsSource>;
  type RelationalItemPlan = PgSelectSinglePlan<typeof relationalItemsSource>;
  type RelationalTopicPlan = PgSelectSinglePlan<typeof relationalTopicsSource>;
  type RelationalPostPlan = PgSelectSinglePlan<typeof relationalPostsSource>;
  type RelationalDividerPlan = PgSelectSinglePlan<
    typeof relationalDividersSource
  >;
  type RelationalChecklistPlan = PgSelectSinglePlan<
    typeof relationalChecklistsSource
  >;
  type RelationalChecklistItemPlan = PgSelectSinglePlan<
    typeof relationalChecklistItemsSource
  >;
  type UnionItemsPlan = PgSelectPlan<typeof unionItemsSource>;
  type UnionItemPlan = PgSelectSinglePlan<typeof unionItemsSource>;
  type UnionTopicPlan = PgSelectSinglePlan<typeof unionTopicsSource>;
  type UnionPostPlan = PgSelectSinglePlan<typeof unionPostsSource>;
  type UnionDividerPlan = PgSelectSinglePlan<typeof unionDividersSource>;
  type UnionChecklistPlan = PgSelectSinglePlan<typeof unionChecklistsSource>;
  type UnionChecklistItemPlan = PgSelectSinglePlan<
    typeof unionChecklistItemsSource
  >;
  type RelationalCommentablesPlan = PgSelectPlan<
    typeof relationalCommentableSource
  >;
  type RelationalCommentablePlan = PgSelectSinglePlan<
    typeof relationalCommentableSource
  >;

  const col = <
    TOptions extends {
      codec: PgTypeCodec;
      notNull?: boolean;
      expression?: PgSourceColumn<any>["expression"];
      // TODO: we could make TypeScript understand the relations on the object
      // rather than just being string.
      via?: PgSourceColumnVia;
      identicalVia?: PgSourceColumnVia;
    },
  >(
    options: TOptions,
  ): PgSourceColumn<
    NullableUnless<TOptions["notNull"], ReturnType<TOptions["codec"]["fromPg"]>>
  > => {
    const { notNull, codec, expression, via, identicalVia } = options;
    return {
      codec,
      notNull: !!notNull,
      expression,
      via,
      identicalVia,
    };
  };

  const userColumns = {
    id: col({ notNull: true, codec: TYPES.uuid }),
    username: col({ notNull: true, codec: TYPES.citext }),
    gravatar_url: col({ codec: TYPES.text }),
    created_at: col({ notNull: true, codec: TYPES.timestamptz }),
  };

  const forumColumns = {
    id: col({ notNull: true, codec: TYPES.uuid }),
    name: col({ notNull: true, codec: TYPES.citext }),
    archived_at: col({ codec: TYPES.timestamptz }),
    is_archived: col({
      codec: TYPES.boolean,
      expression: (alias) => sql`${alias}.archived_at is not null`,
    }),
  };

  const messageColumns = {
    id: col({ notNull: true, codec: TYPES.uuid }),
    body: col({ notNull: true, codec: TYPES.text }),
    author_id: col({
      notNull: true,
      codec: TYPES.uuid,
      identicalVia: { relation: "author", attribute: "person_id" },
    }),
    forum_id: col({
      notNull: true,
      codec: TYPES.uuid,
      identicalVia: { relation: "forum", attribute: "id" },
    }),
    created_at: col({ notNull: true, codec: TYPES.timestamptz }),
    archived_at: col({ codec: TYPES.timestamptz }),
    featured: col({ codec: TYPES.boolean }),
    is_archived: col({
      codec: TYPES.boolean,
      expression: (alias) => sql`${alias}.archived_at is not null`,
    }),
  };

  const executor = EXPORTABLE(
    (PgExecutor, context, object) =>
      new PgExecutor({
        name: "default",
        context: () => {
          const $context = context<OurGraphQLContext>();
          return object<
            PgExecutorContextPlans<OurGraphQLContext["pgSettings"]>
          >({
            pgSettings: $context.get("pgSettings"),
            withPgClient: $context.get("withPgClient"),
          });
        },
      }),
    [PgExecutor, context, object],
  );

  const uniqueAuthorCountSource = EXPORTABLE(
    (PgSource, TYPES, executor, sql) =>
      new PgSource({
        executor,
        codec: TYPES.int,
        source: (...args) =>
          sql`app_public.unique_author_count(${sql.join(args, ", ")})`,
        name: "unique_author_count",
        columns: null,
      }),
    [PgSource, TYPES, executor, sql],
  );

  const forumsUniqueAuthorCountSource = EXPORTABLE(
    (PgSource, TYPES, executor, sql) =>
      new PgSource({
        executor,
        codec: TYPES.int,
        source: (...args) =>
          sql`app_public.forums_unique_author_count(${sql.join(args, ", ")})`,
        name: "forums_unique_author_count",
        columns: null,
      }),
    [PgSource, TYPES, executor, sql],
  );

  const scalarTextSource = EXPORTABLE(
    (PgSource, TYPES, executor, sql) =>
      new PgSource({
        executor,
        codec: TYPES.text,
        source: sql`(select '')`,
        name: "text",
        columns: null,
      }),
    [PgSource, TYPES, executor, sql],
  );

  const messageSourceBuilder = EXPORTABLE(
    (PgSourceBuilder, executor, messageColumns, recordType, sql) =>
      new PgSourceBuilder({
        executor,
        codec: recordType(sql`app_public.messages`, messageColumns),
        source: sql`app_public.messages`,
        name: "messages",
        columns: messageColumns,
        uniques: [["id"]],
      }),
    [PgSourceBuilder, executor, messageColumns, recordType, sql],
  );

  const userSource = EXPORTABLE(
    (PgSource, executor, recordType, sql, userColumns) =>
      new PgSource({
        executor,
        codec: recordType(sql`app_public.users`, userColumns),
        source: sql`app_public.users`,
        name: "users",
        columns: userColumns,
        uniques: [["id"], ["username"]],
      }),
    [PgSource, executor, recordType, sql, userColumns],
  );

  const forumSource = EXPORTABLE(
    (PgSource, executor, forumColumns, recordType, sql) =>
      new PgSource({
        executor,
        codec: recordType(sql`app_public.forums`, forumColumns),
        source: sql`app_public.forums`,
        name: "forums",
        columns: forumColumns,
        uniques: [["id"]],
      }),
    [PgSource, executor, forumColumns, recordType, sql],
  );

  const usersMostRecentForumSource = EXPORTABLE(
    (forumSource, sql) =>
      forumSource.alternativeSource({
        name: "users_most_recent_forum",
        source: (...args) =>
          sql`app_public.users_most_recent_forum(${sql.join(args, ", ")})`,
      }),
    [forumSource, sql],
  );

  const messageSource = EXPORTABLE(
    (forumSource, messageSourceBuilder, userSource) =>
      messageSourceBuilder.build({
        relations: {
          author: {
            source: userSource,
            localColumns: [`author_id`],
            remoteColumns: [`id`],
            isUnique: true,
          },
          forum: {
            source: forumSource,
            localColumns: ["forum_id"],
            remoteColumns: ["id"],
            isUnique: true,
          },
        },
      }),
    [forumSource, messageSourceBuilder, userSource],
  );

  const featuredMessages = messageSource.alternativeSource({
    name: "featured_messages",
    source: (...args) =>
      sql`app_public.featured_messages(${sql.join(args, ", ")})`,
  });

  const forumsFeaturedMessages = messageSource.alternativeSource({
    name: "forums_featured_messages",
    source: (...args) =>
      sql`app_public.forums_featured_messages(${sql.join(args, ", ")})`,
  });

  const unionEntityColumns = {
    person_id: col({ codec: TYPES.int, notNull: false }),
    post_id: col({ codec: TYPES.int, notNull: false }),
    comment_id: col({ codec: TYPES.int, notNull: false }),
  };

  const personBookmarkColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    person_id: col({
      codec: TYPES.int,
      notNull: true,
      identicalVia: { relation: "person", attribute: "id" },
    }),
    bookmarked_entity: col({
      codec: recordType(
        sql`interfaces_and_unions.union__entity`,
        unionEntityColumns,
      ),
      notNull: true,
    }),
  };
  const personBookmarksSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.person_bookmarks`,
      personBookmarkColumns,
    ),
    source: sql`interfaces_and_unions.person_bookmarks`,
    name: "person_bookmarks",
    columns: personBookmarkColumns,
    uniques: [["id"]],
  });

  const personColumns = {
    person_id: col({ codec: TYPES.int, notNull: true }),
    username: col({ codec: TYPES.text, notNull: true }),
  };

  const personSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(sql`interfaces_and_unions.people`, personColumns),
    source: sql`interfaces_and_unions.people`,
    name: "people",
    columns: personColumns,
    uniques: [["person_id"], ["username"]],
  });

  const postColumns = {
    post_id: col({ codec: TYPES.int, notNull: true }),
    author_id: col({
      codec: TYPES.int,
      notNull: true,
      identicalVia: { relation: "author", attribute: "person_id" },
    }),
    body: col({ codec: TYPES.text, notNull: true }),
  };

  const postSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(sql`interfaces_and_unions.posts`, postColumns),
    source: sql`interfaces_and_unions.posts`,
    name: "posts",
    columns: postColumns,
    uniques: [["post_id"]],
  });

  const commentColumns = {
    comment_id: col({ codec: TYPES.int, notNull: true }),
    author_id: col({
      codec: TYPES.int,
      notNull: true,
      identicalVia: { relation: "author", attribute: "person_id" },
    }),
    post_id: col({
      codec: TYPES.int,
      notNull: true,
      identicalVia: { relation: "post", attribute: "id" },
    }),
    body: col({ codec: TYPES.text, notNull: true }),
  };

  const commentSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(sql`interfaces_and_unions.comments`, commentColumns),
    source: sql`interfaces_and_unions.comments`,
    name: "comments",
    columns: commentColumns,
    uniques: [["comment_id"]],
  });

  const itemTypeEnumSource = EXPORTABLE(
    (PgEnumSource, enumType, sql) =>
      new PgEnumSource({
        codec: enumType(sql`interfaces_and_unions.item_type`, [
          "TOPIC",
          "POST",
          "DIVIDER",
          "CHECKLIST",
          "CHECKLIST_ITEM",
        ]),
      }),
    [PgEnumSource, enumType, sql],
  );

  const enumTablesItemTypeColumns = {
    type: {
      codec: TYPES.text,
      notNull: true,
    },
    description: {
      codec: TYPES.text,
      notNull: false,
    },
  };

  const enumTableItemTypeSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.enum_table_item_type`,
      enumTablesItemTypeColumns,
    ),
    source: sql`interfaces_and_unions.enum_table_item_type`,
    name: "enum_table_item_type",
    columns: enumTablesItemTypeColumns,
    uniques: [["type"]],
  });

  const enumTableItemTypeSource = EXPORTABLE(
    (enumTableItemTypeSourceBuilder) =>
      enumTableItemTypeSourceBuilder.build({}),
    [enumTableItemTypeSourceBuilder],
  );

  const enumTableItemTypeEnumSource = EXPORTABLE(
    (PgEnumSource, enumTableItemTypeSource, enumType, sql) =>
      new PgEnumSource({
        codec: enumType(sql`text`, [
          "TOPIC",
          "POST",
          "DIVIDER",
          "CHECKLIST",
          "CHECKLIST_ITEM",
        ]),
        extensions: {
          tableSource: enumTableItemTypeSource,
        },
      }),
    [PgEnumSource, enumTableItemTypeSource, enumType, sql],
  );

  const EnumTableItemType = new GraphQLEnumType({
    name: "EnumTableItemType",
    values: {
      TOPIC: { value: "TOPIC" },
      POST: { value: "POST" },
      DIVIDER: { value: "DIVIDER" },
      CHECKLIST: { value: "CHECKLIST" },
      CHECKLIST_ITEM: { value: "CHECKLIST_ITEM" },
    },
  });

  const singleTableItemColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    type: col({
      codec: itemTypeEnumSource.codec,
      notNull: true,
    }),
    type2: col({
      codec: enumTableItemTypeEnumSource.codec,
      notNull: true,
    }),

    parent_id: col({
      codec: TYPES.int,
      notNull: false,
      identicalVia: { relation: "parent", attribute: "id" },
    }),
    author_id: col({
      codec: TYPES.int,
      notNull: true,
      identicalVia: { relation: "author", attribute: "person_id" },
    }),
    position: col({ codec: TYPES.bigint, notNull: true }),
    created_at: col({ codec: TYPES.timestamptz, notNull: true }),
    updated_at: col({ codec: TYPES.timestamptz, notNull: true }),
    is_explicitly_archived: col({ codec: TYPES.boolean, notNull: true }),
    archived_at: col({ codec: TYPES.timestamptz, notNull: false }),

    title: col({ codec: TYPES.text, notNull: false }),
    description: col({ codec: TYPES.text, notNull: false }),
    note: col({ codec: TYPES.text, notNull: false }),
    color: col({ codec: TYPES.text, notNull: false }),
  };
  const singleTableItemsSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.single_table_items`,
      singleTableItemColumns,
    ),
    source: sql`interfaces_and_unions.single_table_items`,
    name: "single_table_items",
    columns: singleTableItemColumns,
    uniques: [["id"]],
  });

  const personBookmarksSource = EXPORTABLE(
    (personBookmarksSourceBuilder, personSourceBuilder) =>
      personBookmarksSourceBuilder.build({
        relations: {
          person: {
            source: personSourceBuilder,
            isUnique: true,
            localColumns: ["person_id"],
            remoteColumns: ["person_id"],
          },
        },
      }),
    [personBookmarksSourceBuilder, personSourceBuilder],
  );

  const personSource = EXPORTABLE(
    (
      personBookmarksSource,
      personSourceBuilder,
      postSourceBuilder,
      singleTableItemsSourceBuilder,
    ) =>
      personSourceBuilder.build({
        relations: {
          singleTableItems: {
            source: singleTableItemsSourceBuilder,
            isUnique: false,
            localColumns: ["person_id"],
            remoteColumns: ["author_id"],
          },
          posts: {
            source: postSourceBuilder,
            isUnique: false,
            localColumns: ["person_id"],
            remoteColumns: ["author_id"],
          },
          comments: {
            source: postSourceBuilder,
            isUnique: false,
            localColumns: ["person_id"],
            remoteColumns: ["author_id"],
          },
          personBookmarks: {
            source: personBookmarksSource,
            isUnique: false,
            localColumns: ["person_id"],
            remoteColumns: ["person_id"],
          },
        },
      }),
    [
      personBookmarksSource,
      personSourceBuilder,
      postSourceBuilder,
      singleTableItemsSourceBuilder,
    ],
  );

  const postSource = EXPORTABLE(
    (commentSourceBuilder, personSource, postSourceBuilder) =>
      postSourceBuilder.build({
        relations: {
          author: {
            source: personSource,
            isUnique: true,
            localColumns: ["author_id"],
            remoteColumns: ["person_id"],
          },
          comments: {
            source: commentSourceBuilder,
            isUnique: false,
            localColumns: ["post_id"],
            remoteColumns: ["post_id"],
          },
        },
      }),
    [commentSourceBuilder, personSource, postSourceBuilder],
  );

  const commentSource = EXPORTABLE(
    (commentSourceBuilder, personSource, postSource) =>
      commentSourceBuilder.build({
        relations: {
          author: {
            source: personSource,
            isUnique: true,
            localColumns: ["author_id"],
            remoteColumns: ["person_id"],
          },
          post: {
            source: postSource,
            isUnique: true,
            localColumns: ["post_id"],
            remoteColumns: ["post_id"],
          },
        },
      }),
    [commentSourceBuilder, personSource, postSource],
  );

  const singleTableItemsSource = EXPORTABLE(
    (personSource, singleTableItemsSourceBuilder) =>
      singleTableItemsSourceBuilder.build({
        relations: {
          parent: {
            source: singleTableItemsSourceBuilder,
            isUnique: true,
            localColumns: ["parent_id"],
            remoteColumns: ["id"],
          },
          children: {
            source: singleTableItemsSourceBuilder,
            isUnique: false,
            localColumns: ["id"],
            remoteColumns: ["parent_id"],
          },
          author: {
            source: personSource,
            isUnique: true,
            localColumns: ["author_id"],
            remoteColumns: ["person_id"],
          },
        },
      }),
    [personSource, singleTableItemsSourceBuilder],
  );

  const relationalItemColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    type: col({
      codec: itemTypeEnumSource.codec,
      notNull: true,
    }),
    type2: col({
      codec: enumTableItemTypeEnumSource.codec,
      notNull: true,
    }),

    parent_id: col({
      codec: TYPES.int,
      notNull: false,
      identicalVia: { relation: "parent", attribute: "id" },
    }),
    author_id: col({
      codec: TYPES.int,
      notNull: true,
      identicalVia: { relation: "author", attribute: "person_id" },
    }),
    position: col({ codec: TYPES.bigint, notNull: true }),
    created_at: col({ codec: TYPES.timestamptz, notNull: true }),
    updated_at: col({ codec: TYPES.timestamptz, notNull: true }),
    is_explicitly_archived: col({ codec: TYPES.boolean, notNull: true }),
    archived_at: col({ codec: TYPES.timestamptz, notNull: false }),
  };

  const relationalItemsSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.relational_items`,
      relationalItemColumns,
    ),
    source: sql`interfaces_and_unions.relational_items`,
    name: "relational_items",
    columns: relationalItemColumns,
    uniques: [["id"]],
  });

  const relationalCommentableColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    type: col({
      codec: itemTypeEnumSource.codec,
      notNull: true,
    }),
    type2: col({
      codec: enumTableItemTypeEnumSource.codec,
      notNull: true,
    }),
  };

  const relationalCommentableSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.relational_commentables`,
      relationalCommentableColumns,
    ),
    source: sql`interfaces_and_unions.relational_commentables`,
    name: "relational_commentables",
    columns: relationalCommentableColumns,
  });

  const itemColumns = {
    id: col({ codec: TYPES.int, notNull: true, identicalVia: "item" }),
    type: col({ codec: TYPES.text, notNull: true, via: "item" }),
    type2: col({
      codec: enumTableItemTypeEnumSource.codec,
      notNull: true,
      via: "item",
    }),
    parent_id: col({
      codec: TYPES.int,
      notNull: false,
      via: "item",
    }),
    author_id: col({
      codec: TYPES.int,
      notNull: true,
      via: "item",
    }),
    position: col({ codec: TYPES.bigint, notNull: true, via: "item" }),
    created_at: col({ codec: TYPES.timestamptz, notNull: true, via: "item" }),
    updated_at: col({ codec: TYPES.timestamptz, notNull: true, via: "item" }),
    is_explicitly_archived: col({
      codec: TYPES.boolean,
      notNull: true,
      via: "item",
    }),
    archived_at: col({ codec: TYPES.timestamptz, notNull: false, via: "item" }),
  };

  const itemRelations = {
    item: {
      source: relationalItemsSourceBuilder,
      localColumns: [`id`] as const,
      remoteColumns: [`id`] as const,
      isUnique: true,
    },
    parent: {
      source: relationalItemsSourceBuilder,
      localColumns: [`parent_id`] as const,
      remoteColumns: [`id`] as const,
      isUnique: true,
    },
    author: {
      source: personSource,
      localColumns: [`author_id`] as const,
      remoteColumns: [`person_id`] as const,
      isUnique: true,
    },
  };

  const commentableRelation = {
    source: relationalCommentableSourceBuilder,
    localColumns: [`id`] as const,
    remoteColumns: [`id`] as const,
    isUnique: true,
  };

  const relationalTopicsColumns = {
    title: col({ codec: TYPES.text, notNull: false }),

    ...itemColumns,
  };
  const relationalTopicsSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.relational_topics`,
      relationalTopicsColumns,
    ),
    source: sql`interfaces_and_unions.relational_topics`,
    name: "relational_topics",
    columns: relationalTopicsColumns,
    uniques: [["id"]],
  });

  const relationalPostsColumns = {
    title: col({ codec: TYPES.text, notNull: false }),
    description: col({ codec: TYPES.text, notNull: false }),
    note: col({ codec: TYPES.text, notNull: false }),

    ...itemColumns,
  };
  const relationalPostsSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.relational_posts`,
      relationalPostsColumns,
    ),
    source: sql`interfaces_and_unions.relational_posts`,
    name: "relational_posts",
    columns: relationalPostsColumns,
    uniques: [["id"]],
  });

  const relationalDividersColumns = {
    title: col({ codec: TYPES.text, notNull: false }),
    color: col({ codec: TYPES.text, notNull: false }),

    ...itemColumns,
  };
  const relationalDividersSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.relational_dividers`,
      relationalDividersColumns,
    ),
    source: sql`interfaces_and_unions.relational_dividers`,
    name: "relational_dividers",
    columns: relationalDividersColumns,
    uniques: [["id"]],
  });

  const relationalChecklistsColumns = {
    title: col({ codec: TYPES.text, notNull: false }),

    ...itemColumns,
  };
  const relationalChecklistsSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.relational_checklists`,
      relationalChecklistsColumns,
    ),
    source: sql`interfaces_and_unions.relational_checklists`,
    name: "relational_checklists",
    columns: relationalChecklistsColumns,
    uniques: [["id"]],
  });

  const relationalChecklistItemsColumns = {
    description: col({ codec: TYPES.text, notNull: true }),
    note: col({ codec: TYPES.text, notNull: false }),

    ...itemColumns,
  };
  const relationalChecklistItemsSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.relational_checklist_items`,
      relationalChecklistItemsColumns,
    ),
    source: sql`interfaces_and_unions.relational_checklist_items`,
    name: "relational_checklist_items",
    columns: relationalChecklistItemsColumns,
    uniques: [["id"]],
  });

  const relationalItemsSource = EXPORTABLE(
    (
      personSource,
      relationalChecklistItemsSourceBuilder,
      relationalChecklistsSourceBuilder,
      relationalDividersSourceBuilder,
      relationalItemsSourceBuilder,
      relationalPostsSourceBuilder,
      relationalTopicsSourceBuilder,
    ) =>
      relationalItemsSourceBuilder.build({
        relations: {
          parent: {
            source: relationalItemsSourceBuilder,
            isUnique: true,
            localColumns: ["parent_id"] as const,
            remoteColumns: ["id"] as const,
          },
          children: {
            source: relationalItemsSourceBuilder,
            isUnique: false,
            localColumns: ["id"] as const,
            remoteColumns: ["parent_id"] as const,
          },
          author: {
            source: personSource,
            isUnique: true,
            localColumns: ["author_id"] as const,
            remoteColumns: ["person_id"] as const,
          },
          topic: {
            source: relationalTopicsSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
          post: {
            source: relationalPostsSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
          divider: {
            source: relationalDividersSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
          checklist: {
            source: relationalChecklistsSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
          checklistItem: {
            source: relationalChecklistItemsSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
        },
      }),
    [
      personSource,
      relationalChecklistItemsSourceBuilder,
      relationalChecklistsSourceBuilder,
      relationalDividersSourceBuilder,
      relationalItemsSourceBuilder,
      relationalPostsSourceBuilder,
      relationalTopicsSourceBuilder,
    ],
  );

  const relationalCommentableSource = EXPORTABLE(
    (
      relationalChecklistItemsSourceBuilder,
      relationalChecklistsSourceBuilder,
      relationalCommentableSourceBuilder,
      relationalPostsSourceBuilder,
    ) =>
      relationalCommentableSourceBuilder.build({
        relations: {
          post: {
            source: relationalPostsSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
          checklist: {
            source: relationalChecklistsSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
          checklistItem: {
            source: relationalChecklistItemsSourceBuilder,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
            // reciprocal: 'item',
          },
        },
      }),
    [
      relationalChecklistItemsSourceBuilder,
      relationalChecklistsSourceBuilder,
      relationalCommentableSourceBuilder,
      relationalPostsSourceBuilder,
    ],
  );

  const relationalTopicsSource = EXPORTABLE(
    (itemRelations, relationalTopicsSourceBuilder) =>
      relationalTopicsSourceBuilder.build({
        relations: itemRelations,
      }),
    [itemRelations, relationalTopicsSourceBuilder],
  );
  const relationalPostsSource = EXPORTABLE(
    (commentableRelation, itemRelations, relationalPostsSourceBuilder) =>
      relationalPostsSourceBuilder.build({
        relations: {
          ...itemRelations,
          commentable: commentableRelation,
        },
      }),
    [commentableRelation, itemRelations, relationalPostsSourceBuilder],
  );
  const relationalDividersSource = EXPORTABLE(
    (itemRelations, relationalDividersSourceBuilder) =>
      relationalDividersSourceBuilder.build({
        relations: itemRelations,
      }),
    [itemRelations, relationalDividersSourceBuilder],
  );
  const relationalChecklistsSource = EXPORTABLE(
    (commentableRelation, itemRelations, relationalChecklistsSourceBuilder) =>
      relationalChecklistsSourceBuilder.build({
        relations: {
          ...itemRelations,
          commentable: commentableRelation,
        },
      }),
    [commentableRelation, itemRelations, relationalChecklistsSourceBuilder],
  );
  const relationalChecklistItemsSource = EXPORTABLE(
    (
      commentableRelation,
      itemRelations,
      relationalChecklistItemsSourceBuilder,
    ) =>
      relationalChecklistItemsSourceBuilder.build({
        relations: {
          ...itemRelations,
          commentable: commentableRelation,
        },
      }),
    [commentableRelation, itemRelations, relationalChecklistItemsSourceBuilder],
  );

  ////////////////////////////////////////

  const unionItemsColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    type: col({
      codec: itemTypeEnumSource.codec,
      notNull: true,
    }),
    type2: col({
      codec: enumTableItemTypeEnumSource.codec,
      notNull: true,
    }),
  };
  const unionItemsSourceBuilder = new PgSourceBuilder({
    executor,
    codec: recordType(
      sql`interfaces_and_unions.union_items`,
      unionItemsColumns,
    ),
    source: sql`interfaces_and_unions.union_items`,
    name: "union_items",
    columns: unionItemsColumns,
    uniques: [["id"]],
  });

  const unionTopicsColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    title: col({ codec: TYPES.text, notNull: false }),
  };
  const unionTopicsSource = EXPORTABLE(
    (PgSource, executor, recordType, sql, unionTopicsColumns) =>
      new PgSource({
        executor,
        codec: recordType(
          sql`interfaces_and_unions.union_topics`,
          unionTopicsColumns,
        ),
        source: sql`interfaces_and_unions.union_topics`,
        name: "union_topics",
        columns: unionTopicsColumns,
        uniques: [["id"]],
      }),
    [PgSource, executor, recordType, sql, unionTopicsColumns],
  );

  const unionPostsColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    title: col({ codec: TYPES.text, notNull: false }),
    description: col({ codec: TYPES.text, notNull: false }),
    note: col({ codec: TYPES.text, notNull: false }),
  };
  const unionPostsSource = EXPORTABLE(
    (PgSource, executor, recordType, sql, unionPostsColumns) =>
      new PgSource({
        executor,
        codec: recordType(
          sql`interfaces_and_unions.union_posts`,
          unionPostsColumns,
        ),
        source: sql`interfaces_and_unions.union_posts`,
        name: "union_posts",
        columns: unionPostsColumns,
        uniques: [["id"]],
      }),
    [PgSource, executor, recordType, sql, unionPostsColumns],
  );

  const unionDividersColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    title: col({ codec: TYPES.text, notNull: false }),
    color: col({ codec: TYPES.text, notNull: false }),
  };
  const unionDividersSource = EXPORTABLE(
    (PgSource, executor, recordType, sql, unionDividersColumns) =>
      new PgSource({
        executor,
        codec: recordType(
          sql`interfaces_and_unions.union_dividers`,
          unionDividersColumns,
        ),
        source: sql`interfaces_and_unions.union_dividers`,
        name: "union_dividers",
        columns: unionDividersColumns,
        uniques: [["id"]],
      }),
    [PgSource, executor, recordType, sql, unionDividersColumns],
  );

  const unionChecklistsColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    title: col({ codec: TYPES.text, notNull: false }),
  };
  const unionChecklistsSource = EXPORTABLE(
    (PgSource, executor, recordType, sql, unionChecklistsColumns) =>
      new PgSource({
        executor,
        codec: recordType(
          sql`interfaces_and_unions.union_checklists`,
          unionChecklistsColumns,
        ),
        source: sql`interfaces_and_unions.union_checklists`,
        name: "union_checklists",
        columns: unionChecklistsColumns,
        uniques: [["id"]],
      }),
    [PgSource, executor, recordType, sql, unionChecklistsColumns],
  );

  const unionChecklistItemsColumns = {
    id: col({ codec: TYPES.int, notNull: true }),
    description: col({ codec: TYPES.text, notNull: true }),
    note: col({ codec: TYPES.text, notNull: false }),
  };
  const unionChecklistItemsSource = EXPORTABLE(
    (PgSource, executor, recordType, sql, unionChecklistItemsColumns) =>
      new PgSource({
        executor,
        codec: recordType(
          sql`interfaces_and_unions.union_checklist_items`,
          unionChecklistItemsColumns,
        ),
        source: sql`interfaces_and_unions.union_checklist_items`,
        name: "union_checklist_items",
        columns: unionChecklistItemsColumns,
        uniques: [["id"]],
      }),
    [PgSource, executor, recordType, sql, unionChecklistItemsColumns],
  );

  const unionEntitySource = EXPORTABLE(
    (PgSource, executor, recordType, sql, unionEntityColumns) =>
      new PgSource({
        executor,
        codec: recordType(
          sql`interfaces_and_unions.union__entity`,
          unionEntityColumns,
        ),
        source: sql`(select null::interfaces_and_unions.union__entity)`,
        name: "union__entity",
        columns: unionEntityColumns,
      }),
    [PgSource, executor, recordType, sql, unionEntityColumns],
  );

  const entitySearchSource = EXPORTABLE(
    (sql, unionEntitySource) =>
      unionEntitySource.alternativeSource({
        source: (...args: SQL[]) =>
          sql`interfaces_and_unions.search(${sql.join(args, ", ")})`,
        name: "entity_search",
      }),
    [sql, unionEntitySource],
  );

  const unionItemsSource = EXPORTABLE(
    (
      unionChecklistItemsSource,
      unionChecklistsSource,
      unionDividersSource,
      unionItemsSourceBuilder,
      unionPostsSource,
      unionTopicsSource,
    ) =>
      unionItemsSourceBuilder.build({
        relations: {
          topic: {
            source: unionTopicsSource,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
          },
          post: {
            source: unionPostsSource,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
          },
          divider: {
            source: unionDividersSource,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
          },
          checklist: {
            source: unionChecklistsSource,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
          },
          checklistItem: {
            source: unionChecklistItemsSource,
            localColumns: [`id`] as const,
            remoteColumns: [`id`] as const,
            isUnique: true,
          },
        },
      }),
    [
      unionChecklistItemsSource,
      unionChecklistsSource,
      unionDividersSource,
      unionItemsSourceBuilder,
      unionPostsSource,
      unionTopicsSource,
    ],
  );

  function attrField<TDataSource extends PgSource<any, any, any, any>>(
    attrName: keyof TDataSource["columns"],
    type: GraphQLOutputType,
  ) {
    return {
      type,
      plan: EXPORTABLE(
        (attrName) =>
          function plan($entity: PgSelectSinglePlan<TDataSource>) {
            return $entity.get(attrName);
          },
        [attrName],
      ),
    };
  }

  function singleRelationField<
    TMyDataSource extends PgSource<any, any, any, any>,
    TRelationName extends Parameters<TMyDataSource["getRelation"]>[0],
  >(relation: TRelationName, type: GraphQLOutputType) {
    return {
      type,
      plan: EXPORTABLE(
        (deoptimizeIfAppropriate, relation) =>
          function plan($entity: PgSelectSinglePlan<TMyDataSource>) {
            const $plan = $entity.singleRelation(relation);
            deoptimizeIfAppropriate($plan);
            return $plan;
          },
        [deoptimizeIfAppropriate, relation],
      ),
    };
  }

  const HashType = new GraphQLEnumType({
    name: "HashType",
    values: {
      MD5: { value: "md5" },
      SHA1: { value: "sha1" },
      SHA256: { value: "sha256" },
    },
  });

  const Hashes: GraphQLObjectType = new GraphQLObjectType({
    name: "Hashes",
    fields: () => ({
      md5: {
        type: GraphQLString,
        resolve(parent) {
          return crypto.createHash("md5").update(parent.text).digest("hex");
        },
      },
      sha1: {
        type: GraphQLString,
        resolve(parent) {
          return crypto.createHash("sha1").update(parent.text).digest("hex");
        },
      },
      throwNonNullError: {
        type: new GraphQLNonNull(GraphQLString),
        resolve() {
          return null;
        },
      },
      throwTestError: {
        type: GraphQLString,
        resolve() {
          throw new Error("Test");
        },
      },
      sha256: {
        type: GraphQLString,
        resolve(parent) {
          return crypto.createHash("sha256").update(parent.text).digest("hex");
        },
      },
      self: {
        type: Hashes,
        resolve(parent) {
          return parent;
        },
      },
    }),
  });

  const User = newObjectTypeBuilder<OurGraphQLContext, UserPlan>(
    PgSelectSinglePlan,
  )({
    name: "User",
    fields: () => ({
      username: attrField("username", GraphQLString),
      gravatarUrl: attrField("gravatar_url", GraphQLString),
      mostRecentForum: {
        type: Forum,
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, pgSelect, usersMostRecentForumSource) =>
            ($user) => {
              const $forum = pgSelect({
                source: usersMostRecentForumSource,
                args: [{ plan: $user.record() }],
                identifiers: [],
              }).single();
              deoptimizeIfAppropriate($forum);
              return $forum;
            },
          [deoptimizeIfAppropriate, pgSelect, usersMostRecentForumSource],
        ),
      },

      // This field is to test standard resolvers work on planned types
      usernameHash: {
        type: GraphQLString,
        args: {
          hashType: {
            type: new GraphQLNonNull(HashType),
          },
        },
        plan: EXPORTABLE(
          (object) =>
            function plan($user) {
              return object({ username: $user.get("username") });
            },
          [object],
        ),
        resolve(user, args) {
          return crypto
            .createHash(args.hashType)
            .update(user.username)
            .digest("hex");
        },
      },
      // This field is to test standard resolvers work when returning non-scalars on planned types
      usernameHashes: {
        type: Hashes,
        plan: EXPORTABLE(
          () =>
            function plan($user) {
              return $user.get("username");
            },
          [],
        ),
        resolve(username) {
          return { text: username };
        },
      },
    }),
  });

  const MessagesOrderBy = new GraphQLEnumType({
    name: "MessagesOrderBy",
    values: {
      BODY_ASC: {
        value: (plan: PgSelectPlan<typeof messageSource>) => {
          plan.orderBy({
            codec: TYPES.text,
            fragment: sql`${plan.alias}.body`,
            direction: "ASC",
          });
        },
      },
      BODY_DESC: {
        value: (plan: PgSelectPlan<typeof messageSource>) => {
          plan.orderBy({
            codec: TYPES.text,
            fragment: sql`${plan.alias}.body`,
            direction: "DESC",
          });
        },
      },
      AUTHOR_USERNAME_ASC: {
        value: (plan: PgSelectPlan<typeof messageSource>) => {
          const authorAlias = plan.singleRelation("author");
          plan.orderBy({
            codec: TYPES.text,
            fragment: sql`${authorAlias}.username`,
            direction: "ASC",
          });
        },
      },
      AUTHOR_USERNAME_DESC: {
        value: (plan: PgSelectPlan<typeof messageSource>) => {
          const authorAlias = plan.singleRelation("author");
          plan.orderBy({
            codec: TYPES.text,
            fragment: sql`${authorAlias}.username`,
            direction: "DESC",
          });
        },
      },
    },
  });
  const Message = newObjectTypeBuilder<OurGraphQLContext, MessagePlan>(
    PgSelectSinglePlan,
  )({
    name: "Message",
    fields: () => ({
      id: attrField("id", GraphQLString),
      featured: attrField("featured", GraphQLBoolean),
      body: attrField("body", GraphQLString),
      forum: singleRelationField("forum", Forum),
      author: {
        type: User,
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate) =>
            function plan($message) {
              const $user = $message.singleRelation("author");
              deoptimizeIfAppropriate($user);

              return $user;
            },
          [deoptimizeIfAppropriate],
        ),
      },
      isArchived: attrField("is_archived", GraphQLBoolean),
    }),
  });

  const MessageEdge = newObjectTypeBuilder<OurGraphQLContext, MessagePlan>(
    PgSelectSinglePlan,
  )({
    name: "MessageEdge",
    fields: {
      cursor: {
        type: GraphQLString,
        plan: EXPORTABLE(
          () =>
            function plan($node) {
              return $node.cursor();
            },
          [],
        ),
      },
      node: {
        type: Message,
        plan: EXPORTABLE(
          () =>
            function plan($node) {
              return $node;
            },
          [],
        ),
      },
    },
  });

  const MessagesConnection = newObjectTypeBuilder<
    OurGraphQLContext,
    MessageConnectionPlan
  >(PgConnectionPlan)({
    name: "MessagesConnection",
    fields: {
      edges: {
        type: new GraphQLList(MessageEdge),
        plan: EXPORTABLE(
          () =>
            function plan($connection) {
              // return context();
              return $connection.nodes();
            },
          [],
        ),
      },
      nodes: newGraphileFieldConfigBuilder<
        OurGraphQLContext,
        MessageConnectionPlan
      >()({
        type: new GraphQLList(Message),
        plan: EXPORTABLE(
          () =>
            function plan($connection) {
              // return context();
              return $connection.nodes();
            },
          [],
        ),
      }),
    },
  });

  const IncludeArchived = new GraphQLEnumType({
    name: "IncludeArchived",
    values: {
      INHERIT: {
        value: "INHERIT",
      },
      YES: {
        value: "YES",
      },
      NO: {
        value: "NO",
      },
      EXCLUSIVELY: {
        value: "EXCLUSIVELY",
      },
    },
  });

  function makeIncludeArchivedField<TFieldPlan>(
    getClassPlan: ($fieldPlan: TFieldPlan) => PgSelectPlan<any>,
  ) {
    return {
      type: IncludeArchived,
      plan: EXPORTABLE(
        (PgSelectSinglePlan, getClassPlan, sql) =>
          function plan(
            $parent: ExecutablePlan<any>,
            $field: TFieldPlan,
            $value: InputStaticLeafPlan | __TrackedObjectPlan,
          ) {
            const $messages = getClassPlan($field);
            if ($value.evalIs("YES")) {
              // No restriction
            } else if ($value.evalIs("EXCLUSIVELY")) {
              $messages.where(sql`${$messages.alias}.archived_at is not null`);
            } else if (
              $value.evalIs("INHERIT") &&
              // INHERIT only works if the parent has an archived_at column.
              $parent instanceof PgSelectSinglePlan &&
              !!$parent.source.columns.archived_at
            ) {
              $messages.where(
                sql`(${
                  $messages.alias
                }.archived_at is null) = (${$messages.placeholder(
                  $parent.get("archived_at"),
                  sql`timestamptz`,
                )} is null)`,
              );
            } else {
              $messages.where(sql`${$messages.alias}.archived_at is null`);
            }
          },
        [PgSelectSinglePlan, getClassPlan, sql],
      ),
      defaultValue: "INHERIT",
    };
  }

  const MessageCondition = newInputObjectTypeBuilder<
    OurGraphQLContext,
    PgConditionPlan<any>
  >()({
    name: "MessageCondition",
    fields: {
      featured: {
        type: GraphQLBoolean,
        plan: EXPORTABLE(
          (sql) =>
            function plan($condition, $value) {
              if ($value.evalIs(null)) {
                $condition.where(sql`${$condition.alias}.featured is null`);
              } else {
                $condition.where(
                  sql`${$condition.alias}.featured = ${$condition.placeholder(
                    $value,
                    sql`boolean`,
                  )}`,
                );
              }
            },
          [sql],
        ),
      },
    },
  });

  class ClassFilterPlan extends ModifierPlan<PgConditionPlan<any>> {
    private conditions: SQL[] = [];

    constructor(parent: PgConditionPlan<any>, public readonly alias: SQL) {
      super(parent);
    }

    where(condition: SQL) {
      this.conditions.push(condition);
    }

    placeholder($plan: ExecutablePlan<any>, type: SQL): SQL {
      return this.$parent.placeholder($plan, type);
    }

    apply() {
      this.conditions.forEach((condition) => this.$parent.where(condition));
    }
  }

  const BooleanFilterPlan = EXPORTABLE(
    (ModifierPlan) =>
      class BooleanFilterPlan extends ModifierPlan<ClassFilterPlan> {
        private conditions: SQL[] = [];

        constructor(
          $classFilterPlan: ClassFilterPlan,
          public readonly expression: SQL,
        ) {
          super($classFilterPlan);
        }

        placeholder($plan: ExecutablePlan<any>, type: SQL): SQL {
          return this.$parent.placeholder($plan, type);
        }

        where(condition: SQL) {
          this.conditions.push(condition);
        }

        apply() {
          this.conditions.forEach((condition) => this.$parent.where(condition));
        }
      },
    [ModifierPlan],
  );
  type BooleanFilterPlan = InstanceType<typeof BooleanFilterPlan>;

  const BooleanFilter = newInputObjectTypeBuilder<
    OurGraphQLContext,
    BooleanFilterPlan
  >()({
    name: "BooleanFilter",
    fields: {
      equalTo: {
        type: GraphQLBoolean,
        plan: EXPORTABLE(
          (sql) =>
            function plan($parent, $value) {
              if ($value.evalIs(null)) {
                // Ignore
              } else {
                $parent.where(
                  sql`${$parent.expression} = ${$parent.placeholder(
                    $value,
                    sql`boolean`,
                  )}`,
                );
              }
            },
          [sql],
        ),
      },
      notEqualTo: {
        type: GraphQLBoolean,
        plan: EXPORTABLE(
          (sql) =>
            function plan($parent: BooleanFilterPlan, $value) {
              if ($value.evalIs(null)) {
                // Ignore
              } else {
                $parent.where(
                  sql`${$parent.expression} <> ${$parent.placeholder(
                    $value,
                    sql`boolean`,
                  )}`,
                );
              }
            },
          [sql],
        ),
      },
    },
  });

  const MessageFilter = newInputObjectTypeBuilder<
    OurGraphQLContext,
    ClassFilterPlan
  >()({
    name: "MessageFilter",
    fields: {
      featured: {
        type: BooleanFilter,
        plan: EXPORTABLE(
          (BooleanFilterPlan, sql) =>
            function plan($messageFilter, $value) {
              if ($value.evalIs(null)) {
                // Ignore
              } else {
                return new BooleanFilterPlan(
                  $messageFilter,
                  sql`${$messageFilter.alias}.featured`,
                );
              }
            },
          [BooleanFilterPlan, sql],
        ),
      },
    },
  });

  const ForumCondition = newInputObjectTypeBuilder<
    OurGraphQLContext,
    PgConditionPlan<any>
  >()({
    name: "ForumCondition",
    fields: {
      name: {
        type: GraphQLString,
        plan: EXPORTABLE(
          (sql) =>
            function plan($condition, $value) {
              if ($value.evalIs(null)) {
                $condition.where(sql`${$condition.alias}.name is null`);
              } else {
                $condition.where(
                  sql`${$condition.alias}.name = ${$condition.placeholder(
                    $value,
                    sql`text`,
                  )}`,
                );
              }
            },
          [sql],
        ),
      },
    },
  });

  class TempTablePlan<TDataSource extends PgSource<any, any, any, any>>
    extends BasePlan
    implements PgConditionCapableParentPlan
  {
    public readonly alias: SQL;
    public readonly conditions: SQL[] = [];
    constructor(
      public readonly $parent: ClassFilterPlan,
      public readonly source: TDataSource,
    ) {
      super();
      this.alias = sql.identifier(Symbol(`${source.name}_filter`));
    }

    placeholder($plan: ExecutablePlan<any>, type: SQL): SQL {
      return this.$parent.placeholder($plan, type);
    }

    where(condition: SQL): void {
      this.conditions.push(condition);
    }
    wherePlan() {
      return new PgConditionPlan(this);
    }

    fromExpression() {
      const source = this.source.source;
      if (typeof source === "function") {
        throw new Error("TempTablePlan doesn't support function sources yet.");
      } else {
        return source;
      }
    }
  }

  class ManyFilterPlan<
    TChildDataSource extends PgSource<any, any, any, any>,
  > extends ModifierPlan<ClassFilterPlan> {
    public $some: TempTablePlan<TChildDataSource> | null = null;
    constructor(
      $parentFilterPlan: ClassFilterPlan,
      public childDataSource: TChildDataSource,
      private myAttrs: string[],
      private theirAttrs: string[],
    ) {
      super($parentFilterPlan);
      if (myAttrs.length !== theirAttrs.length) {
        throw new Error(
          "Expected the local and remote attributes to have the same number of entries.",
        );
      }
    }

    some() {
      const $table = new TempTablePlan(this.$parent, this.childDataSource);

      // Implement the relationship
      this.myAttrs.forEach((attr, i) => {
        $table.where(
          sql`${this.$parent.alias}.${sql.identifier(attr)} = ${
            $table.alias
          }.${sql.identifier(this.theirAttrs[i])}`,
        );
      });

      const $filter = new ClassFilterPlan($table.wherePlan(), $table.alias);
      this.$some = $table;
      return $filter;
    }

    apply() {
      if (this.$some) {
        const conditions = this.$some.conditions;
        const from = sql`\nfrom ${this.$some.fromExpression()} as ${
          this.$some.alias
        }`;
        const sqlConditions = sql.join(
          conditions.map((c) => sql.parens(sql.indent(c))),
          " and ",
        );
        const where =
          conditions.length === 0
            ? sql.blank
            : conditions.length === 1
            ? sql`\nwhere ${sqlConditions}`
            : sql`\nwhere\n${sql.indent(sqlConditions)}`;
        this.$parent.where(
          sql`exists(${sql.indent(sql`select 1${from}${where}`)})`,
        );
      }
    }
  }

  const ForumToManyMessageFilter = newInputObjectTypeBuilder<
    OurGraphQLContext,
    ManyFilterPlan<typeof messageSource>
  >()({
    name: "ForumToManyMessageFilter",
    fields: {
      some: {
        type: MessageFilter,
        plan: EXPORTABLE(
          () =>
            function plan($manyFilter, $value) {
              if (!$value.evalIs(null)) {
                return $manyFilter.some();
              }
            },
          [],
        ),
      },
    },
  });

  const ForumFilter = newInputObjectTypeBuilder<
    OurGraphQLContext,
    ClassFilterPlan
  >()({
    name: "ForumFilter",
    fields: {
      messages: {
        type: ForumToManyMessageFilter,
        plan: EXPORTABLE(
          (ManyFilterPlan, messageSource) =>
            function plan($condition, $value) {
              if (!$value.evalIs(null)) {
                return new ManyFilterPlan(
                  $condition,
                  messageSource,
                  ["id"],
                  ["forum_id"],
                );
              }
            },
          [ManyFilterPlan, messageSource],
        ),
      },
    },
  });

  const Forum: GraphQLObjectType<any, OurGraphQLContext> = newObjectTypeBuilder<
    OurGraphQLContext,
    ForumPlan
  >(PgSelectSinglePlan)({
    name: "Forum",
    fields: () => ({
      id: attrField("id", GraphQLString),
      name: attrField("name", GraphQLString),

      // Expression column
      isArchived: attrField("is_archived", GraphQLBoolean),

      // Custom expression; actual column select shouldn't make it through to the generated query.
      archivedAtIsNotNull: {
        type: GraphQLBoolean,
        plan: EXPORTABLE(
          (TYPES, pgClassExpression) =>
            function plan($forum) {
              const $archivedAt = $forum.get("archived_at");
              const $expr1 = pgClassExpression(
                $forum,
                TYPES.boolean,
              )`${$archivedAt} is not null`;
              const $expr2 = pgClassExpression(
                $forum,
                TYPES.boolean,
              )`${$expr1} is true`;
              return $expr2;
            },
          [TYPES, pgClassExpression],
        ),
      },
      self: {
        type: Forum,
        plan: EXPORTABLE(
          () =>
            function plan($forum) {
              return $forum;
            },
          [],
        ),
      },
      messagesList: {
        type: new GraphQLList(Message),
        args: {
          first: {
            type: GraphQLInt,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$forum,
                  $messages: PgSelectPlan<typeof messageSource>,
                  $value,
                ) {
                  $messages.setFirst($value.eval());
                  return null;
                },
              [],
            ),
          },
          condition: {
            type: MessageCondition,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$forum,
                  $messages: PgSelectPlan<typeof messageSource>,
                ) {
                  return $messages.wherePlan();
                },
              [],
            ),
          },
          filter: {
            type: MessageFilter,
            plan: EXPORTABLE(
              (ClassFilterPlan) =>
                function plan(
                  _$forum,
                  $messages: PgSelectPlan<typeof messageSource>,
                ) {
                  return new ClassFilterPlan(
                    $messages.wherePlan(),
                    $messages.alias,
                  );
                },
              [ClassFilterPlan],
            ),
          },
          includeArchived: makeIncludeArchivedField<
            PgSelectPlan<typeof messageSource>
          >(($messages) => $messages),
        },
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, messageSource) =>
            function plan($forum) {
              const $forumId = $forum.get("id");
              const $messages = messageSource.find({ forum_id: $forumId });
              deoptimizeIfAppropriate($messages);
              $messages.setTrusted();
              // $messages.leftJoin(...);
              // $messages.innerJoin(...);
              // $messages.relation('fk_messages_author_id')
              // $messages.where(...);
              // $messages.orderBy(...);
              return $messages;
            },
          [deoptimizeIfAppropriate, messageSource],
        ),
      },
      messagesConnection: {
        type: MessagesConnection,
        args: {
          first: {
            type: GraphQLInt,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$forum,
                  $connection: PgConnectionPlan<typeof messageSource>,
                  $value,
                ) {
                  const $messages = $connection.getSubplan();
                  $messages.setFirst($value.eval());
                  return null;
                },
              [],
            ),
          },
          last: {
            type: GraphQLInt,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                  $value,
                ) {
                  const $messages = $connection.getSubplan();
                  $messages.setLast($value.eval());
                  return null;
                },
              [],
            ),
          },
          condition: {
            type: MessageCondition,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$forum,
                  $connection: PgConnectionPlan<typeof messageSource>,
                ) {
                  const $messages = $connection.getSubplan();
                  return $messages.wherePlan();
                },
              [],
            ),
          },
          filter: {
            type: MessageFilter,
            plan: EXPORTABLE(
              (ClassFilterPlan) =>
                function plan(
                  _$forum,
                  $connection: PgConnectionPlan<typeof messageSource>,
                ) {
                  const $messages = $connection.getSubplan();
                  return new ClassFilterPlan(
                    $messages.wherePlan(),
                    $messages.alias,
                  );
                },
              [ClassFilterPlan],
            ),
          },
          includeArchived: makeIncludeArchivedField<
            PgConnectionPlan<typeof messageSource>
          >(($connection) => $connection.getSubplan()),
        },
        plan: EXPORTABLE(
          (PgConnectionPlan, deoptimizeIfAppropriate, messageSource) =>
            function plan($forum) {
              const $messages = messageSource.find({
                forum_id: $forum.get("id"),
              });
              $messages.setTrusted();
              deoptimizeIfAppropriate($messages);
              // $messages.leftJoin(...);
              // $messages.innerJoin(...);
              // $messages.relation('fk_messages_author_id')
              // $messages.where(...);
              const $connectionPlan = new PgConnectionPlan($messages);
              // $connectionPlan.orderBy... ?
              // DEFINITELY NOT $messages.orderBy BECAUSE we don't want that applied to aggregates.
              // DEFINITELY NOT $messages.limit BECAUSE we don't want those limits applied to aggregates or page info.
              return $connectionPlan;
            },
          [PgConnectionPlan, deoptimizeIfAppropriate, messageSource],
        ),
      },
      uniqueAuthorCount: {
        type: GraphQLInt,
        args: {
          featured: {
            type: GraphQLBoolean,
          },
        },
        plan: EXPORTABLE(
          (TYPES, forumsUniqueAuthorCountSource, pgSelect) =>
            function plan($forum, args) {
              const $featured = args.featured;
              return pgSelect({
                source: forumsUniqueAuthorCountSource,
                identifiers: [],
                args: [
                  {
                    plan: $forum.record(),
                  },
                  {
                    plan: $featured,
                    type: TYPES.boolean.sqlType,
                  },
                ],
              })
                .single()
                .getSelfNamed();
            },
          [TYPES, forumsUniqueAuthorCountSource, pgSelect],
        ),
      },

      randomUser: {
        type: User,
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, pgSelect, sql, userSource) =>
            function plan($forum) {
              const $user = pgSelect({
                source: userSource,
                identifiers: [],
                args: [
                  {
                    plan: $forum.record(),
                  },
                ],
                from: (...args: SQL[]) =>
                  sql`app_public.forums_random_user(${sql.join(args, ", ")})`,
                name: "forums_random_user",
              }).single();
              deoptimizeIfAppropriate($user);
              return $user;
            },
          [deoptimizeIfAppropriate, pgSelect, sql, userSource],
        ),
      },

      featuredMessages: {
        type: new GraphQLList(Message),
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, forumsFeaturedMessages, pgSelect) =>
            function plan($forum) {
              const $messages = pgSelect({
                source: forumsFeaturedMessages,
                identifiers: [],
                args: [
                  {
                    plan: $forum.record(),
                  },
                ],
              });
              deoptimizeIfAppropriate($messages);
              return $messages;
            },
          [deoptimizeIfAppropriate, forumsFeaturedMessages, pgSelect],
        ),
      },
    }),
  });

  const singleTableTypeName = ($entity: SingleTableItemPlan) => {
    const $type = $entity.get("type");
    const $typeName = lambda($type, (v) => {
      const type = {
        TOPIC: "SingleTableTopic",
        POST: "SingleTablePost",
        DIVIDER: "SingleTableDivider",
        CHECKLIST: "SingleTableChecklist",
        CHECKLIST_ITEM: "SingleTableChecklistItem",
      }[v];
      if (!type) {
        throw new Error(`Could not determine type for '${v}'`);
      }
      return type;
    });
    return $typeName;
  };

  const singleTableItemInterface = ($item: SingleTableItemPlan) =>
    pgSingleTablePolymorphic(singleTableTypeName($item), $item);

  const relationalItemInterface = ($item: RelationalItemPlan) =>
    pgPolymorphic($item, $item.get("type"), {
      RelationalTopic: {
        match: (t) => t === "TOPIC",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("topic")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      RelationalPost: {
        match: (t) => t === "POST",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("post")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      RelationalDivider: {
        match: (t) => t === "DIVIDER",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("divider")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      RelationalChecklist: {
        match: (t) => t === "CHECKLIST",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("checklist")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      RelationalChecklistItem: {
        match: (t) => t === "CHECKLIST_ITEM",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("checklistItem")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
    });

  const unionItemUnion = ($item: UnionItemPlan) =>
    pgPolymorphic($item, $item.get("type"), {
      UnionTopic: {
        match: (t) => t === "TOPIC",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("topic")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      UnionPost: {
        match: (t) => t === "POST",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("post")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      UnionDivider: {
        match: (t) => t === "DIVIDER",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("divider")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      UnionChecklist: {
        match: (t) => t === "CHECKLIST",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("checklist")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      UnionChecklistItem: {
        match: (t) => t === "CHECKLIST_ITEM",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("checklistItem")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
    });

  const relationalCommentableInterface = ($item: RelationalCommentablePlan) =>
    pgPolymorphic($item, $item.get("type"), {
      RelationalPost: {
        match: (t) => t === "POST",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("post")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      RelationalChecklist: {
        match: (t) => t === "CHECKLIST",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("checklist")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
      RelationalChecklistItem: {
        match: (t) => t === "CHECKLIST_ITEM",
        plan: EXPORTABLE(
          ($item, deoptimizeIfAppropriate) => () =>
            deoptimizeIfAppropriate($item.singleRelation("checklistItem")),
          [$item, deoptimizeIfAppropriate],
        ),
      },
    });

  /**
   * This makes a polymorphic plan that returns the "entity" represented by the
   * "interfaces_and_unions.union__entity" type in the database (a composite
   * type with an attribute that's a "foreign key" to each table that's
   * included in the union).
   *
   * i.e. if `$item.get('person_id')` is set, then it's a Person and we should
   * grab that person from the `personSource`. If `post_id` is set it's a Post,
   * and so on.
   */
  const entityUnion = <
    TPlan extends PgClassExpressionPlan<
      any,
      PgTypeCodec<any, any, typeof unionEntityColumns>
    >,
  >(
    $item: TPlan,
  ) =>
    pgPolymorphic(
      $item,
      list([
        $item.get("person_id"),
        $item.get("post_id"),
        $item.get("comment_id"),
      ]),
      {
        Person: {
          match: (v) => v[0] != null,
          plan: EXPORTABLE(
            (personSource) => ($list) =>
              personSource.get({ person_id: $list.at(0) }),
            [personSource],
          ),
        },
        Post: {
          match: (v) => v[1] != null,
          plan: EXPORTABLE(
            (postSource) => ($list) => postSource.get({ post_id: $list.at(1) }),
            [postSource],
          ),
        },
        Comment: {
          match: (v) => v[2] != null,
          plan: EXPORTABLE(
            (commentSource) => ($list) =>
              commentSource.get({ comment_id: $list.at(2) }),
            [commentSource],
          ),
        },
      },
    );

  const PersonBookmark: GraphQLObjectType<any, OurGraphQLContext> =
    newObjectTypeBuilder<OurGraphQLContext, PersonBookmarkPlan>(
      PgSelectSinglePlan,
    )({
      name: "PersonBookmark",
      fields: () => ({
        id: attrField("id", GraphQLInt),
        person: singleRelationField("person", Person),
        bookmarkedEntity: {
          type: Entity,
          plan: EXPORTABLE(
            (entityUnion) =>
              function plan($personBookmark) {
                const $entity = $personBookmark.get("bookmarked_entity");
                return entityUnion($entity);
              },
            [entityUnion],
          ),
        },
      }),
    });

  const Person: GraphQLObjectType<any, OurGraphQLContext> =
    newObjectTypeBuilder<OurGraphQLContext, PersonPlan>(PgSelectSinglePlan)({
      name: "Person",
      fields: () => ({
        personId: attrField("person_id", GraphQLInt),
        username: attrField("username", GraphQLString),
        singleTableItemsList: {
          type: new GraphQLList(SingleTableItem),
          plan: EXPORTABLE(
            (
              deoptimizeIfAppropriate,
              each,
              singleTableItemInterface,
              singleTableItemsSource,
            ) =>
              function plan($person) {
                const $personId = $person.get("person_id");
                const $items: SingleTableItemsPlan =
                  singleTableItemsSource.find({
                    author_id: $personId,
                  });
                deoptimizeIfAppropriate($items);
                return each($items, ($item) => singleTableItemInterface($item));
              },
            [
              deoptimizeIfAppropriate,
              each,
              singleTableItemInterface,
              singleTableItemsSource,
            ],
          ),
        },

        relationalItemsList: {
          type: new GraphQLList(RelationalItem),
          plan: EXPORTABLE(
            (
              deoptimizeIfAppropriate,
              each,
              relationalItemInterface,
              relationalItemsSource,
            ) =>
              function plan($person) {
                const $personId = $person.get("person_id");
                const $items: RelationalItemsPlan = relationalItemsSource.find({
                  author_id: $personId,
                });
                deoptimizeIfAppropriate($items);
                return each($items, ($item) => relationalItemInterface($item));
              },
            [
              deoptimizeIfAppropriate,
              each,
              relationalItemInterface,
              relationalItemsSource,
            ],
          ),
        },

        personBookmarksList: {
          type: new GraphQLList(PersonBookmark),
          plan: EXPORTABLE(
            () =>
              function plan($person) {
                return $person.manyRelation("personBookmarks");
              },
            [],
          ),
        },
      }),
    });

  const Post: GraphQLObjectType<any, OurGraphQLContext> = newObjectTypeBuilder<
    OurGraphQLContext,
    PostPlan
  >(PgSelectSinglePlan)({
    name: "Post",
    fields: () => ({
      postId: attrField("post_id", GraphQLInt),
      body: attrField("body", GraphQLString),
      author: singleRelationField("author", Person),
    }),
  });

  const Comment: GraphQLObjectType<any, OurGraphQLContext> =
    newObjectTypeBuilder<OurGraphQLContext, CommentPlan>(PgSelectSinglePlan)({
      name: "Comment",
      fields: () => ({
        commentId: attrField("comment_id", GraphQLInt),
        author: singleRelationField("author", Person),
        post: singleRelationField("post", Post),
        body: attrField("body", GraphQLString),
      }),
    });

  ////////////////////////////////////////

  const SingleTableItem: GraphQLInterfaceType = new GraphQLInterfaceType({
    name: "SingleTableItem",
    fields: () => ({
      id: { type: GraphQLInt },
      type: { type: GraphQLString },
      type2: { type: EnumTableItemType },
      parent: { type: SingleTableItem },
      author: { type: Person },
      position: { type: GraphQLString },
      createdAt: { type: GraphQLString },
      updatedAt: { type: GraphQLString },
      isExplicitlyArchived: { type: GraphQLBoolean },
      archivedAt: { type: GraphQLString },
    }),
    resolveType,
  });

  const commonSingleTableItemFields = {
    id: attrField("id", GraphQLInt),
    type: attrField("type", GraphQLString),
    type2: attrField("type2", EnumTableItemType),
    parent: {
      type: SingleTableItem,
      plan: EXPORTABLE(
        (deoptimizeIfAppropriate, singleTableItemInterface) =>
          function plan($entity: SingleTableItemPlan) {
            const $plan = $entity.singleRelation("parent");
            deoptimizeIfAppropriate($plan);
            return singleTableItemInterface($plan);
          },
        [deoptimizeIfAppropriate, singleTableItemInterface],
      ),
    },
    author: singleRelationField("author", Person),
    position: attrField("position", GraphQLString),
    createdAt: attrField("created_at", GraphQLString),
    updatedAt: attrField("updated_at", GraphQLString),
    isExplicitlyArchived: attrField("is_explicitly_archived", GraphQLBoolean),
    archivedAt: attrField("archived_at", GraphQLString),
  };

  const SingleTableTopic = newObjectTypeBuilder<
    OurGraphQLContext,
    SingleTableItemPlan
  >(PgSelectSinglePlan)({
    name: "SingleTableTopic",
    interfaces: [SingleTableItem],
    fields: () => ({
      ...commonSingleTableItemFields,
      title: attrField("title", GraphQLString),
    }),
  });

  const SingleTablePost = newObjectTypeBuilder<
    OurGraphQLContext,
    SingleTableItemPlan
  >(PgSelectSinglePlan)({
    name: "SingleTablePost",
    interfaces: [SingleTableItem],
    fields: () => ({
      ...commonSingleTableItemFields,
      title: attrField("title", GraphQLString),
      description: attrField("description", GraphQLString),
      note: attrField("note", GraphQLString),
    }),
  });

  const SingleTableDivider = newObjectTypeBuilder<
    OurGraphQLContext,
    SingleTableItemPlan
  >(PgSelectSinglePlan)({
    name: "SingleTableDivider",
    interfaces: [SingleTableItem],
    fields: () => ({
      ...commonSingleTableItemFields,
      title: attrField("title", GraphQLString),
      color: attrField("color", GraphQLString),
    }),
  });

  const SingleTableChecklist = newObjectTypeBuilder<
    OurGraphQLContext,
    SingleTableItemPlan
  >(PgSelectSinglePlan)({
    name: "SingleTableChecklist",
    interfaces: [SingleTableItem],
    fields: () => ({
      ...commonSingleTableItemFields,
      title: attrField("title", GraphQLString),
    }),
  });

  const SingleTableChecklistItem = newObjectTypeBuilder<
    OurGraphQLContext,
    SingleTableItemPlan
  >(PgSelectSinglePlan)({
    name: "SingleTableChecklistItem",
    interfaces: [SingleTableItem],
    fields: () => ({
      ...commonSingleTableItemFields,
      description: attrField("description", GraphQLString),
      note: attrField("note", GraphQLString),
    }),
  });

  ////////////////////////////////////////

  const RelationalItem: GraphQLInterfaceType = new GraphQLInterfaceType({
    name: "RelationalItem",
    fields: () => ({
      id: { type: GraphQLInt },
      type: { type: GraphQLString },
      type2: { type: EnumTableItemType },
      parent: { type: RelationalItem },
      author: { type: Person },
      position: { type: GraphQLString },
      createdAt: { type: GraphQLString },
      updatedAt: { type: GraphQLString },
      isExplicitlyArchived: { type: GraphQLBoolean },
      archivedAt: { type: GraphQLString },
    }),
    resolveType,
  });

  const RelationalCommentable: GraphQLInterfaceType = new GraphQLInterfaceType({
    name: "RelationalCommentable",
    fields: () => ({
      id: { type: GraphQLInt },
      type: { type: GraphQLString },
      type2: { type: EnumTableItemType },
    }),
    resolveType,
  });

  // NOTE: the `| any`s below are because of co/contravariance woes.
  const commonRelationalItemFields = <
    TDataSource extends PgSource<
      any,
      | {
          id: PgSourceColumn<number>;
          type: PgSourceColumn<string>;
          position: PgSourceColumn<string>;
          created_at: PgSourceColumn<Date>;
          updated_at: PgSourceColumn<Date>;
          is_explicitly_archived: PgSourceColumn<boolean>;
          archived_at: PgSourceColumn<Date>;
        }
      | any,
      any,
      { parent: PgSourceRelation<any, any> } | any,
      any
    >,
  >() => ({
    id: attrField<TDataSource>("id", GraphQLInt),
    type: attrField<TDataSource>("type", GraphQLString),
    type2: attrField<TDataSource>("type2", EnumTableItemType),
    parent: {
      type: RelationalItem,
      plan: EXPORTABLE(
        (deoptimizeIfAppropriate, relationalItemInterface) =>
          function plan($entity: PgSelectSinglePlan<TDataSource>) {
            const $plan = $entity.singleRelation("parent");
            deoptimizeIfAppropriate($plan);
            return relationalItemInterface($plan);
          },
        [deoptimizeIfAppropriate, relationalItemInterface],
      ),
    },
    author: singleRelationField("author", Person),
    position: attrField<TDataSource>("position", GraphQLString),
    createdAt: attrField<TDataSource>("created_at", GraphQLString),
    updatedAt: attrField<TDataSource>("updated_at", GraphQLString),
    isExplicitlyArchived: attrField<TDataSource>(
      "is_explicitly_archived",
      GraphQLBoolean,
    ),
    archivedAt: attrField<TDataSource>("archived_at", GraphQLString),
  });

  const RelationalTopic = newObjectTypeBuilder<
    OurGraphQLContext,
    RelationalTopicPlan
  >(PgSelectSinglePlan)({
    name: "RelationalTopic",
    interfaces: [RelationalItem],
    fields: () => ({
      ...commonRelationalItemFields(),
      title: attrField("title", GraphQLString),
    }),
  });

  const RelationalPost = newObjectTypeBuilder<
    OurGraphQLContext,
    RelationalPostPlan
  >(PgSelectSinglePlan)({
    name: "RelationalPost",
    interfaces: [RelationalItem, RelationalCommentable],
    fields: () => ({
      ...commonRelationalItemFields(),
      title: attrField("title", GraphQLString),
      description: attrField("description", GraphQLString),
      note: attrField("note", GraphQLString),

      titleLower: {
        type: GraphQLString,
        plan: EXPORTABLE(
          (pgSelect, scalarTextSource, sql) =>
            function plan($entity) {
              return pgSelect({
                source: scalarTextSource,
                identifiers: [],
                args: [
                  {
                    plan: $entity.record(),
                  },
                ],
                from: (...args: SQL[]) =>
                  sql`interfaces_and_unions.relational_posts_title_lower(${sql.join(
                    args,
                    ", ",
                  )})`,
                name: "relational_posts_title_lower",
              })
                .single()
                .getSelfNamed();
            },
          [pgSelect, scalarTextSource, sql],
        ),
      },
    }),
  });

  const RelationalDivider = newObjectTypeBuilder<
    OurGraphQLContext,
    RelationalDividerPlan
  >(PgSelectSinglePlan)({
    name: "RelationalDivider",
    interfaces: [RelationalItem],
    fields: () => ({
      ...commonRelationalItemFields(),
      title: attrField("title", GraphQLString),
      color: attrField("color", GraphQLString),
    }),
  });

  const RelationalChecklist = newObjectTypeBuilder<
    OurGraphQLContext,
    RelationalChecklistPlan
  >(PgSelectSinglePlan)({
    name: "RelationalChecklist",
    interfaces: [RelationalItem, RelationalCommentable],
    fields: () => ({
      ...commonRelationalItemFields(),
      title: attrField("title", GraphQLString),
    }),
  });

  const RelationalChecklistItem = newObjectTypeBuilder<
    OurGraphQLContext,
    RelationalChecklistItemPlan
  >(PgSelectSinglePlan)({
    name: "RelationalChecklistItem",
    interfaces: [RelationalItem, RelationalCommentable],
    fields: () => ({
      ...commonRelationalItemFields(),
      description: attrField("description", GraphQLString),
      note: attrField("note", GraphQLString),
    }),
  });

  ////////////////////////////////////////

  const UnionItem: GraphQLUnionType = new GraphQLUnionType({
    name: "UnionItem",
    resolveType,
    types: () => [
      UnionTopic,
      UnionPost,
      UnionDivider,
      UnionChecklist,
      UnionChecklistItem,
    ],
  });

  const UnionTopic = newObjectTypeBuilder<OurGraphQLContext, UnionTopicPlan>(
    PgSelectSinglePlan,
  )({
    name: "UnionTopic",
    fields: () => ({
      id: attrField("id", GraphQLInt),
      title: attrField("title", GraphQLString),
    }),
  });

  const UnionPost = newObjectTypeBuilder<OurGraphQLContext, UnionPostPlan>(
    PgSelectSinglePlan,
  )({
    name: "UnionPost",
    fields: () => ({
      id: attrField("id", GraphQLInt),
      title: attrField("title", GraphQLString),
      description: attrField("description", GraphQLString),
      note: attrField("note", GraphQLString),
    }),
  });

  const UnionDivider = newObjectTypeBuilder<
    OurGraphQLContext,
    UnionDividerPlan
  >(PgSelectSinglePlan)({
    name: "UnionDivider",
    fields: () => ({
      id: attrField("id", GraphQLInt),
      title: attrField("title", GraphQLString),
      color: attrField("color", GraphQLString),
    }),
  });

  const UnionChecklist = newObjectTypeBuilder<
    OurGraphQLContext,
    UnionChecklistPlan
  >(PgSelectSinglePlan)({
    name: "UnionChecklist",
    fields: () => ({
      id: attrField("id", GraphQLInt),
      title: attrField("title", GraphQLString),
    }),
  });

  const UnionChecklistItem = newObjectTypeBuilder<
    OurGraphQLContext,
    UnionChecklistItemPlan
  >(PgSelectSinglePlan)({
    name: "UnionChecklistItem",
    fields: () => ({
      id: attrField("id", GraphQLInt),
      description: attrField("description", GraphQLString),
      note: attrField("note", GraphQLString),
    }),
  });

  ////////////////////////////////////////

  const Entity: GraphQLUnionType = new GraphQLUnionType({
    name: "Entity",
    resolveType,
    types: () => [Person, Post, Comment],
  });

  ////////////////////////////////////////

  const Query = newObjectTypeBuilder<
    OurGraphQLContext,
    __ValuePlan<BaseGraphQLRootValue>
  >(__ValuePlan)({
    name: "Query",
    fields: {
      forums: {
        type: new GraphQLList(Forum),
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, forumSource) =>
            function plan(_$root) {
              const $forums = forumSource.find();
              deoptimizeIfAppropriate($forums);
              return $forums;
            },
          [deoptimizeIfAppropriate, forumSource],
        ),
        args: {
          first: {
            type: GraphQLInt,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $forums: PgSelectPlan<typeof forumSource>,
                  $value,
                ) {
                  $forums.setFirst($value.eval());
                  return null;
                },
              [],
            ),
          },
          includeArchived: makeIncludeArchivedField<
            PgSelectPlan<typeof forumSource>
          >(($forums) => $forums),
          condition: {
            type: ForumCondition,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $forums: PgSelectPlan<typeof forumSource>,
                ) {
                  return $forums.wherePlan();
                },
              [],
            ),
          },
          filter: {
            type: ForumFilter,
            plan: EXPORTABLE(
              (ClassFilterPlan) =>
                function plan(
                  _$root,
                  $forums: PgSelectPlan<typeof forumSource>,
                ) {
                  return new ClassFilterPlan(
                    $forums.wherePlan(),
                    $forums.alias,
                  );
                },
              [ClassFilterPlan],
            ),
          },
        },
      },
      forum: {
        type: Forum,
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, forumSource) =>
            function plan(_$root, args) {
              const $forum = forumSource.get({ id: args.id });
              deoptimizeIfAppropriate($forum);
              return $forum;
            },
          [deoptimizeIfAppropriate, forumSource],
        ),
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLString),
          },
        },
      },
      message: {
        type: Message,
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, messageSource) =>
            function plan(_$root, args) {
              const $message = messageSource.get({ id: args.id });
              deoptimizeIfAppropriate($message);
              return $message;
            },
          [deoptimizeIfAppropriate, messageSource],
        ),
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLString),
          },
        },
      },
      allMessagesConnection: {
        type: MessagesConnection,
        args: {
          condition: {
            type: MessageCondition,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                ) {
                  const $messages = $connection.getSubplan();
                  return $messages.wherePlan();
                },
              [],
            ),
          },
          filter: {
            type: MessageFilter,
            plan: EXPORTABLE(
              (ClassFilterPlan) =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                ) {
                  const $messages = $connection.getSubplan();
                  return new ClassFilterPlan(
                    $messages.wherePlan(),
                    $messages.alias,
                  );
                },
              [ClassFilterPlan],
            ),
          },
          includeArchived: makeIncludeArchivedField<
            PgConnectionPlan<typeof messageSource>
          >(($connection) => $connection.getSubplan()),
          first: {
            type: GraphQLInt,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                  $value,
                ) {
                  const $messages = $connection.getSubplan();
                  $messages.setFirst($value.eval());
                  return null;
                },
              [],
            ),
          },
          last: {
            type: GraphQLInt,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                  $value,
                ) {
                  const $messages = $connection.getSubplan();
                  $messages.setLast($value.eval());
                  return null;
                },
              [],
            ),
          },
          after: {
            type: GraphQLString,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                  $value,
                ) {
                  const $messages = $connection.getSubplan();
                  $messages.afterLock("orderBy", () => {
                    $messages.after($value.eval());
                  });
                  return null;
                },
              [],
            ),
          },
          before: {
            type: GraphQLString,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                  $value,
                ) {
                  const $messages = $connection.getSubplan();
                  $messages.afterLock("orderBy", () => {
                    $messages.before($value.eval());
                  });
                  return null;
                },
              [],
            ),
          },
          orderBy: {
            type: new GraphQLList(new GraphQLNonNull(MessagesOrderBy)),
            plan: EXPORTABLE(
              (inspect) =>
                function plan(
                  _$root,
                  $connection: PgConnectionPlan<typeof messageSource>,
                  $value,
                ) {
                  const $messages = $connection.getSubplan();
                  const val = $value.eval();
                  if (!val) {
                    return null;
                  }
                  if (!Array.isArray(val)) {
                    throw new Error("Invalid!");
                  }
                  val.forEach((order) => {
                    if (typeof order !== "function") {
                      console.error(
                        `Internal server error: invalid orderBy configuration: expected function, but received ${inspect(
                          order,
                        )}`,
                      );
                      throw new Error(
                        "Internal server error: invalid orderBy configuration",
                      );
                    }
                    order($messages);
                  });
                  return null;
                },
              [inspect],
            ),
          },
        },
        plan: EXPORTABLE(
          (PgConnectionPlan, deoptimizeIfAppropriate, messageSource) =>
            function plan() {
              const $messages = messageSource.find();
              deoptimizeIfAppropriate($messages);
              // $messages.leftJoin(...);
              // $messages.innerJoin(...);
              // $messages.relation('fk_messages_author_id')
              // $messages.where(...);
              const $connectionPlan = new PgConnectionPlan($messages);
              // $connectionPlan.orderBy... ?
              // DEFINITELY NOT $messages.orderBy BECAUSE we don't want that applied to aggregates.
              // DEFINITELY NOT $messages.limit BECAUSE we don't want those limits applied to aggregates or page info.
              return $connectionPlan;
            },
          [PgConnectionPlan, deoptimizeIfAppropriate, messageSource],
        ),
      },

      uniqueAuthorCount: {
        type: GraphQLInt,
        args: {
          featured: {
            type: GraphQLBoolean,
          },
        },
        plan: EXPORTABLE(
          (TYPES, deoptimizeIfAppropriate, pgSelect, uniqueAuthorCountSource) =>
            function plan(_$root, args) {
              const $featured = args.featured;
              const $plan = pgSelect({
                source: uniqueAuthorCountSource,
                identifiers: [],
                args: [
                  {
                    plan: $featured,
                    type: TYPES.boolean.sqlType,
                    name: "featured",
                  },
                ],
              });
              deoptimizeIfAppropriate($plan);
              return $plan.single().getSelfNamed();
            },
          [TYPES, deoptimizeIfAppropriate, pgSelect, uniqueAuthorCountSource],
        ),
      },

      forumNames: {
        type: new GraphQLList(GraphQLString),
        plan: EXPORTABLE(
          (each, pgSelect, scalarTextSource, sql) =>
            function plan(_$root) {
              const $plan = pgSelect({
                source: scalarTextSource,
                identifiers: [],
                from: sql`app_public.forum_names()`,
                name: "forum_names",
              });
              return each($plan, ($name) => $name.getSelfNamed());
            },
          [each, pgSelect, scalarTextSource, sql],
        ),
      },

      FORUM_NAMES: {
        type: new GraphQLList(GraphQLString),
        description: "Like forumNames, only we convert them all to upper case",
        plan: EXPORTABLE(
          (each, lambda, pgSelect, scalarTextSource, sql) =>
            function plan(_$root) {
              const $plan = pgSelect({
                source: scalarTextSource,
                identifiers: [],
                from: sql`app_public.forum_names()`,
                name: "forum_names",
              });
              return each($plan, ($name) =>
                lambda($name.getSelfNamed(), (name) => name.toUpperCase()),
              );
            },
          [each, lambda, pgSelect, scalarTextSource, sql],
        ),
      },

      randomUser: {
        type: User,
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, pgSelect, sql, userSource) =>
            function plan() {
              const $users = pgSelect({
                source: userSource,
                identifiers: [],
                from: sql`app_public.random_user()`,
                name: "random_user",
              });
              deoptimizeIfAppropriate($users);
              return $users.single();
            },
          [deoptimizeIfAppropriate, pgSelect, sql, userSource],
        ),
      },

      featuredMessages: {
        type: new GraphQLList(Message),
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, featuredMessages, pgSelect) =>
            function plan() {
              const $messages = pgSelect({
                source: featuredMessages,
                identifiers: [],
              });
              deoptimizeIfAppropriate($messages);
              return $messages;
            },
          [deoptimizeIfAppropriate, featuredMessages, pgSelect],
        ),
      },
      people: {
        type: new GraphQLList(Person),
        plan: EXPORTABLE(
          (deoptimizeIfAppropriate, personSource) =>
            function plan() {
              const $people = personSource.find();
              deoptimizeIfAppropriate($people);
              return $people;
            },
          [deoptimizeIfAppropriate, personSource],
        ),
      },

      singleTableItemById: {
        type: SingleTableItem,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        plan: EXPORTABLE(
          (singleTableItemInterface, singleTableItemsSource) =>
            function plan(_$root, args) {
              const $item: SingleTableItemPlan = singleTableItemsSource.get({
                id: args.id,
              });
              return singleTableItemInterface($item);
            },
          [singleTableItemInterface, singleTableItemsSource],
        ),
      },

      singleTableTopicById: {
        type: SingleTableTopic,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        plan: EXPORTABLE(
          (constant, singleTableItemsSource) =>
            function plan(_$root, args) {
              const $item: SingleTableItemPlan = singleTableItemsSource.get({
                id: args.id,
                type: constant("TOPIC"),
              });
              return $item;
            },
          [constant, singleTableItemsSource],
        ),
      },

      relationalItemById: {
        type: RelationalItem,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        plan: EXPORTABLE(
          (relationalItemInterface, relationalItemsSource) =>
            function plan(_$root, args) {
              const $item: RelationalItemPlan = relationalItemsSource.get({
                id: args.id,
              });
              return relationalItemInterface($item);
            },
          [relationalItemInterface, relationalItemsSource],
        ),
      },

      relationalTopicById: {
        type: RelationalTopic,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        plan: EXPORTABLE(
          (relationalTopicsSource) =>
            function plan(_$root, args) {
              return relationalTopicsSource.get({
                id: args.id,
              });
            },
          [relationalTopicsSource],
        ),
      },

      allRelationalCommentablesList: {
        type: new GraphQLList(new GraphQLNonNull(RelationalCommentable)),
        args: {
          first: {
            type: GraphQLInt,
            plan: EXPORTABLE(
              () =>
                function plan(
                  _$root,
                  $each: EachPlan<any, any, any, any>,
                  $value,
                ) {
                  const $commentables =
                    $each.originalListPlan() as RelationalCommentablesPlan;
                  $commentables.setFirst($value.eval());
                  return null;
                },
              [],
            ),
          },
        },
        plan: EXPORTABLE(
          (
            TYPES,
            each,
            relationalCommentableInterface,
            relationalCommentableSource,
            sql,
          ) =>
            function plan() {
              const $commentables: RelationalCommentablesPlan =
                relationalCommentableSource.find();
              $commentables.orderBy({
                codec: TYPES.int,
                fragment: sql`${$commentables.alias}.id`,
                direction: "ASC",
              });
              return each($commentables, ($commentable) =>
                relationalCommentableInterface($commentable),
              );
            },
          [
            TYPES,
            each,
            relationalCommentableInterface,
            relationalCommentableSource,
            sql,
          ],
        ),
      },

      unionItemById: {
        type: UnionItem,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        plan: EXPORTABLE(
          (unionItemUnion, unionItemsSource) =>
            function plan(_$root, args) {
              const $item: UnionItemPlan = unionItemsSource.get({
                id: args.id,
              });
              return unionItemUnion($item);
            },
          [unionItemUnion, unionItemsSource],
        ),
      },

      unionTopicById: {
        type: UnionTopic,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        plan: EXPORTABLE(
          (unionTopicsSource) =>
            function plan(_$root, args) {
              return unionTopicsSource.get({
                id: args.id,
              });
            },
          [unionTopicsSource],
        ),
      },

      allUnionItemsList: {
        type: new GraphQLList(new GraphQLNonNull(UnionItem)),
        plan: EXPORTABLE(
          (TYPES, each, sql, unionItemUnion, unionItemsSource) =>
            function plan() {
              const $items: UnionItemsPlan = unionItemsSource.find();
              $items.orderBy({
                codec: TYPES.int,
                fragment: sql`${$items.alias}.id`,
                direction: "ASC",
              });
              return each($items, ($item) => unionItemUnion($item));
            },
          [TYPES, each, sql, unionItemUnion, unionItemsSource],
        ),
      },

      searchEntities: {
        type: new GraphQLList(new GraphQLNonNull(Entity)),
        args: {
          query: {
            type: new GraphQLNonNull(GraphQLString),
          },
        },
        plan: EXPORTABLE(
          (
            TYPES,
            deoptimizeIfAppropriate,
            each,
            entitySearchSource,
            entityUnion,
            pgSelect,
          ) =>
            function plan(_$root, args) {
              const $plan = pgSelect({
                source: entitySearchSource,
                identifiers: [],
                args: [
                  {
                    plan: args.query,
                    type: TYPES.text.sqlType,
                    name: "query",
                  },
                ],
              });
              deoptimizeIfAppropriate($plan);
              return each($plan, ($item) => entityUnion($item.record()));
            },
          [
            TYPES,
            deoptimizeIfAppropriate,
            each,
            entitySearchSource,
            entityUnion,
            pgSelect,
          ],
        ),
      },

      personByPersonId: {
        type: Person,
        args: {
          personId: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        },
        plan: EXPORTABLE(
          (personSource) =>
            function plan(_$root, args) {
              return personSource.get({ person_id: args.personId });
            },
          [personSource],
        ),
      },
    },
  });

  const CreateRelationalPostInput = newInputObjectTypeBuilder()({
    name: "CreateRelationalPostInput",
    fields: {
      title: {
        type: new GraphQLNonNull(GraphQLString),
      },
      description: {
        type: GraphQLString,
      },
      note: {
        type: GraphQLString,
      },
    },
  });

  const RelationalPostPatch = newInputObjectTypeBuilder()({
    name: "RelationalPostPatch",
    fields: {
      // All nullable, since it's a patch.
      title: {
        type: GraphQLString,
      },
      description: {
        type: GraphQLString,
      },
      note: {
        type: GraphQLString,
      },
    },
  });

  const UpdateRelationalPostByIdInput = newInputObjectTypeBuilder()({
    name: "UpdateRelationalPostByIdInput",
    fields: {
      id: {
        type: new GraphQLNonNull(GraphQLInt),
      },
      patch: {
        type: new GraphQLNonNull(RelationalPostPatch),
      },
    },
  });

  const DeleteRelationalPostByIdInput = newInputObjectTypeBuilder()({
    name: "DeleteRelationalPostByIdInput",
    fields: {
      id: {
        type: new GraphQLNonNull(GraphQLInt),
      },
    },
  });

  type PgRecord<TDataSource extends PgSource<any, any, any, any, any>> =
    PgClassExpressionPlan<TDataSource, TDataSource["codec"]>;

  const CreateRelationalPostPayload = newObjectTypeBuilder<
    OurGraphQLContext,
    PgRecord<typeof relationalPostsSource>
  >(PgClassExpressionPlan)({
    name: "CreateRelationalPostPayload",
    fields: {
      post: {
        type: RelationalPost,
        plan: EXPORTABLE(
          (relationalPostsSource) =>
            function plan($post) {
              return relationalPostsSource.get({ id: $post.get("id") });
            },
          [relationalPostsSource],
        ),
      },
      id: {
        type: GraphQLInt,
        plan: EXPORTABLE(
          () =>
            function plan($post) {
              return $post.get("id");
            },
          [],
        ),
      },
      query: {
        type: Query,
        plan: EXPORTABLE(
          (aether) =>
            function plan() {
              return aether().rootValuePlan;
            },
          [aether],
        ),
      },
    },
  });

  const UpdateRelationalPostByIdPayload = newObjectTypeBuilder<
    OurGraphQLContext,
    PgUpdatePlan<typeof relationalPostsSource>
  >(PgUpdatePlan)({
    name: "UpdateRelationalPostByIdPayload",
    fields: {
      post: {
        type: RelationalPost,
        plan: EXPORTABLE(
          (relationalPostsSource) =>
            function plan($post) {
              return relationalPostsSource.get({ id: $post.get("id") });
            },
          [relationalPostsSource],
        ),
      },
      id: {
        type: GraphQLInt,
        plan: EXPORTABLE(
          () =>
            function plan($post) {
              return $post.get("id");
            },
          [],
        ),
      },
      query: {
        type: Query,
        plan: EXPORTABLE(
          (aether) =>
            function plan() {
              return aether().rootValuePlan;
            },
          [aether],
        ),
      },
    },
  });

  const DeleteRelationalPostByIdPayload = newObjectTypeBuilder<
    OurGraphQLContext,
    PgDeletePlan<typeof relationalPostsSource>
  >(PgDeletePlan)({
    name: "DeleteRelationalPostByIdPayload",
    fields: {
      // Since we've deleted the post we cannot go and fetch it; so we must
      // return the record from the mutation RETURNING clause
      post: {
        type: RelationalPost,
        plan: EXPORTABLE(
          (pgSelectSingleFromRecord, relationalPostsSource) =>
            function plan($post) {
              return pgSelectSingleFromRecord(
                relationalPostsSource,
                $post.record(),
              );
            },
          [pgSelectSingleFromRecord, relationalPostsSource],
        ),
      },

      id: {
        type: GraphQLInt,
        plan: EXPORTABLE(
          () =>
            function plan($post) {
              return $post.get("id");
            },
          [],
        ),
      },
      query: {
        type: Query,
        plan: EXPORTABLE(
          (aether) =>
            function plan() {
              return aether().rootValuePlan;
            },
          [aether],
        ),
      },
    },
  });

  const Mutation = newObjectTypeBuilder<
    OurGraphQLContext,
    __ValuePlan<BaseGraphQLRootValue>
  >(__ValuePlan)({
    name: "Mutation",
    fields: {
      createRelationalPost: {
        args: {
          input: {
            type: new GraphQLNonNull(CreateRelationalPostInput),
          },
        },
        type: CreateRelationalPostPayload,
        plan: EXPORTABLE(
          (constant, pgInsert, relationalItemsSource, relationalPostsSource) =>
            function plan(_$root, args) {
              const $item = pgInsert(relationalItemsSource, {
                type: constant`POST`,
                author_id: constant(2),
              });
              const $itemId = $item.get("id");
              // TODO: make this TypeScript stuff automatic
              const $input = args.input as InputObjectPlan;
              const $post = pgInsert(relationalPostsSource, {
                id: $itemId,
              });
              for (const key of ["title", "description", "note"] as Array<
                keyof typeof relationalPostsSource.columns
              >) {
                const $value = $input.get(key);
                if (!$value.evalIs(undefined)) {
                  $post.set(key, $value);
                }
              }

              // NOTE: returning a record() here is unnecessary and requires
              // `select *` privileges. In a normal schema we'd just return the
              // mutation plan directly. Even if we're sharing types it would
              // generally be better to return the identifier and then look up the
              // record using the identifier. Nonetheless, this is useful for tests.

              // Since our field type, `CreateRelationalPostPayload`, is shared between
              // `createRelationalPost`, `createThreeRelationalPosts` and
              // `createThreeRelationalPostsComputed` must return a common plan
              // type that `CreateRelationalPostPayload` can use; in this case a
              // `PgClassExpressionPlan`
              return $post.record();
            },
          [constant, pgInsert, relationalItemsSource, relationalPostsSource],
        ),
      },

      createThreeRelationalPosts: {
        description:
          "This silly mutation is specifically to ensure that mutation plans are not tree-shaken - we never want to throw away mutation side effects.",
        type: CreateRelationalPostPayload,
        plan: EXPORTABLE(
          (constant, pgInsert, relationalItemsSource, relationalPostsSource) =>
            function plan() {
              // Only the _last_ post plan is returned; there's no dependency on
              // the first two posts, and yet they should not be tree-shaken
              // because they're mutations.
              let $post: PgInsertPlan<typeof relationalPostsSource>;
              for (let i = 0; i < 3; i++) {
                const $item = pgInsert(relationalItemsSource, {
                  type: constant`POST`,
                  author_id: constant(2),
                });
                const $itemId = $item.get("id");
                $post = pgInsert(relationalPostsSource, {
                  id: $itemId,
                  title: constant(`Post #${i + 1}`),
                  description: constant(`Desc ${i + 1}`),
                  note: constant(null),
                });
              }

              // See NOTE in createRelationalPost plan.
              return $post!.record();
            },
          [constant, pgInsert, relationalItemsSource, relationalPostsSource],
        ),
      },

      createThreeRelationalPostsComputed: {
        description:
          "This silly mutation is specifically to ensure that mutation plans are not tree-shaken even if they use plans that are normally side-effect free - we never want to throw away mutation side effects.",
        type: CreateRelationalPostPayload,
        plan: EXPORTABLE(
          (TYPES, constant, pgSelect, relationalPostsSource, sql) =>
            function plan() {
              // Only the _last_ post plan is returned; there's no dependency on
              // the first two posts, and yet they should not be tree-shaken
              // because they're mutations.
              let $post: PgSelectPlan<typeof relationalPostsSource>;
              for (let i = 0; i < 3; i++) {
                $post = pgSelect({
                  source: relationalPostsSource,
                  identifiers: [],
                  from: (authorId, title) =>
                    sql`interfaces_and_unions.insert_post(${authorId}, ${title})`,
                  args: [
                    {
                      plan: constant(2),
                      type: TYPES.int.sqlType,
                    },
                    {
                      plan: constant(`Computed post #${i + 1}`),
                      type: TYPES.text.sqlType,
                    },
                  ],
                });
                $post.hasSideEffects = true;
              }

              // See NOTE in createRelationalPost plan.
              return $post!.single().record();
            },
          [TYPES, constant, pgSelect, relationalPostsSource, sql],
        ),
      },

      updateRelationalPostById: {
        args: {
          input: {
            type: new GraphQLNonNull(UpdateRelationalPostByIdInput),
          },
        },
        type: UpdateRelationalPostByIdPayload,
        plan: EXPORTABLE(
          (pgUpdate, relationalPostsSource) =>
            function plan(_$root, args) {
              const $input = args.input as InputObjectPlan;
              const $patch = $input.get("patch") as InputObjectPlan;
              const $post = pgUpdate(relationalPostsSource, {
                id: $input.get("id"),
              });
              for (const key of ["title", "description", "note"] as Array<
                keyof typeof relationalPostsSource.columns
              >) {
                const $value = $patch.get(key);
                // TODO: test that we differentiate between value set to null and
                // value not being present
                if (!$value.evalIs(undefined)) {
                  $post.set(key, $value);
                }
              }
              return $post;
            },
          [pgUpdate, relationalPostsSource],
        ),
      },

      deleteRelationalPostById: {
        args: {
          input: {
            type: new GraphQLNonNull(DeleteRelationalPostByIdInput),
          },
        },
        type: DeleteRelationalPostByIdPayload,
        plan: EXPORTABLE(
          (pgDelete, relationalPostsSource) =>
            function plan(_$root, args) {
              const $input = args.input as InputObjectPlan;
              const $post = pgDelete(relationalPostsSource, {
                id: $input.get("id"),
              });
              return $post;
            },
          [pgDelete, relationalPostsSource],
        ),
      },
    },
  });

  const ForumMessageSubscriptionPayload = newObjectTypeBuilder<
    OurGraphQLContext,
    JSONParsePlan<{ id: string; op: string }>
  >(JSONParsePlan)({
    name: "ForumMessageSubscriptionPayload",
    fields: {
      operationType: {
        type: GraphQLString,
        plan: EXPORTABLE(
          (lambda) =>
            function plan($event) {
              return lambda($event.get("op"), (txt) =>
                String(txt).toLowerCase(),
              );
            },
          [lambda],
        ),
      },
      message: {
        type: Message,
        plan: EXPORTABLE(
          (messageSource) =>
            function plan($event) {
              return messageSource.get({ id: $event.get("id") });
            },
          [messageSource],
        ),
      },
    },
  });

  const Subscription = newObjectTypeBuilder<
    OurGraphQLContext,
    __ValuePlan<BaseGraphQLRootValue>
  >(__ValuePlan)({
    name: "Subscription",
    fields: {
      forumMessage: {
        args: {
          forumId: {
            type: new GraphQLNonNull(GraphQLString),
          },
        },
        type: ForumMessageSubscriptionPayload,
        subscribePlan: EXPORTABLE(
          (context, jsonParse, lambda, subscribe) =>
            function subscribePlan(_$root, args) {
              const $forumId = args.forumId as InputStaticLeafPlan<number>;
              const $topic = lambda($forumId, (id) => `forum:${id}:message`);
              const $pgSubscriber = context<OurGraphQLContext>().get(
                "pgSubscriber",
              ) as AccessPlan<CrystalSubscriber>;

              return subscribe($pgSubscriber, $topic, jsonParse);
            },
          [context, jsonParse, lambda, subscribe],
        ),
        plan: EXPORTABLE(
          () =>
            function plan($event) {
              return $event;
            },
          [],
        ),
      },
    },
  });

  return crystalEnforce(
    new GraphQLSchema({
      query: Query,
      mutation: Mutation,
      subscription: Subscription,
      types: [
        // Don't forget to add all types that implement interfaces here
        // otherwise they _might_ not show up in the schema.

        SingleTableTopic,
        SingleTablePost,
        SingleTableDivider,
        SingleTableChecklist,
        SingleTableChecklistItem,

        RelationalTopic,
        RelationalPost,
        RelationalDivider,
        RelationalChecklist,
        RelationalChecklistItem,
      ],
    }),
  );
}

async function main() {
  const filePath = `${__dirname}/schema.graphql`;
  const schema = makeExampleSchema();
  writeFileSync(
    filePath,
    //prettier.format(
    printSchema(schema),
    //{
    //  ...(await prettier.resolveConfig(filePath)),
    //  parser: "graphql",
    //}),
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}