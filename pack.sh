#!/usr/bin/env bash
set -e -x

rm -rf builds/
mkdir builds/

# graphile-config
cd utils/graphile-config
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/graphile-config.tgz
cd -

# ruru
cd grafast/ruru
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/ruru.tgz
cd -

# @graphile/lru
cd utils/lru
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/graphile__lru.tgz
cd -

#grafast
cd grafast/grafast
yarn build
cp -a ../../.yarn ../../.yarnrc.yml release
rm -Rf /tmp/grafast-build
mv release /tmp/grafast-build
# Build in temp folder
cd /tmp/grafast-build
rm -f *.tgz
yarn pack -o package.tgz
cd -
# Grab package
mv /tmp/grafast-build/package.tgz ../../builds/grafast.tgz
rm -Rf /tmp/grafast-build
cd ../..

#grafserv
cd grafast/grafserv
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/grafserv.tgz
cd -

#@dataplan/json
cd grafast/dataplan-json
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/dataplan__json.tgz
cd -

#eslint-plugin-graphile-export
cd utils/eslint-plugin-graphile-export
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/eslint-plugin-graphile-export.tgz
cd -

#graphile-utils
cd graphile-build/graphile-utils
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/graphile-utils.tgz
cd -

#graphile-export
cd utils/graphile-export
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/graphile-export.tgz
cd -

#jest-serializer-graphql-schema
cd utils/jest-serializer-graphql-schema
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/jest-serializer-graphql-schema.tgz
cd -

#jest-serializer-simple
cd utils/jest-serializer-simple
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/jest-serializer-simple.tgz
cd -

#graphile-build
cd graphile-build/graphile-build
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/graphile-build.tgz
cd -

#pg-introspection
cd utils/pg-introspection
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/pg-introspection.tgz
cd -

#pg-sql2
cd utils/pg-sql2
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/pg-sql2.tgz
cd -

#@dataplan/pg # NEEDS CUSTOM RELEASE
cd grafast/dataplan-pg
yarn build
cp -a ../../.yarn ../../.yarnrc.yml release
rm -Rf /tmp/dataplan__pg-build
mv release /tmp/dataplan__pg-build
# Build in temp folder
cd /tmp/dataplan__pg-build
rm -f *.tgz
yarn pack -o package.tgz
cd -
# Grab package
mv /tmp/dataplan__pg-build/package.tgz ../../builds/dataplan__pg.tgz
rm -Rf /tmp/dataplan__pg-build
cd ../..

#graphile-build-pg
cd graphile-build/graphile-build-pg/
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/graphile-build-pg.tgz
cd -

#postgraphile
cd postgraphile/postgraphile/
rm -f *.tgz
yarn pack -o package.tgz
mv package.tgz ../../builds/postgraphile.tgz
cd -

echo "All packages packed into 'builds/'"
echo "Now publish them with './publish.sh'"