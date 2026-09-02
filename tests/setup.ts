// File-store tests assume no live database. Postgres coverage installs its
// own mock and sets DATABASE_URL after this runs.
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
