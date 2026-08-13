---
description: rules
---

Database modification rules:

1. Never modify database directly.

2. Always read current schema from:
database/schema_current.sql

3. If a new feature requires database change:
   create a new SQL migration inside
   /database/migrations

4. Migration file must contain pure SQL commands.

5. Also update schema_current.sql to reflect
   the latest structure after migration.

6. Explain what the migration does.