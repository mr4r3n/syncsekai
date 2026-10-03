#!/bin/sh
set -eu

PRISMA=./node_modules/.bin/prisma

# Schema changes are versioned migrations (prisma/migrations). A database created
# before them, with `prisma db push`, has tables but no migration history and
# `migrate deploy` refuses it (P3005). Bring it to the baseline once (`db push`
# stops instead of dropping data) and record the baseline as applied.
if ! output=$($PRISMA migrate deploy 2>&1); then
  echo "$output"
  case "$output" in
    *P3005*)
      echo "Existing database without migration history: recording the baseline."
      $PRISMA db push --skip-generate
      $PRISMA migrate resolve --applied 0_init
      $PRISMA migrate deploy
      ;;
    *)
      exit 1
      ;;
  esac
else
  echo "$output"
fi

exec node dist/src/main
