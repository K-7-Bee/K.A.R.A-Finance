-- Remove the test helpers installed by 00_helpers.test.sql.
begin;
select plan(1);
drop schema tests cascade;
select hasnt_schema('tests', 'test helpers removed');
select * from finish();
commit;
