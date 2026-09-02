// File-store tests assume no live database. Postgres tests set DATABASE_URL
// themselves after this runs, against a throwaway database.
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
