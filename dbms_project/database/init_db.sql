-- =============================================================================
-- ADBMS Project: Master Database Initialization Script
-- Executes Schema, PL/pgSQL Triggers, Procedures, Functions, Views, and Seed Data
-- =============================================================================

\echo '---------------------------------------------------'
\echo '1/5 Initializing Schema (Tables & Constraints)...'
\i schema.sql

\echo '2/5 Creating PL/pgSQL Triggers (Fraud Detection Rules 1, 2, 3)...'
\i plsql_triggers.sql

\echo '3/5 Creating PL/pgSQL Stored Procedures & Transactions...'
\i plsql_procedures.sql

\echo '4/5 Creating PL/pgSQL Functions & Reporting Views...'
\i plsql_functions.sql
\i plsql_views.sql

\echo '5/5 Seeding Initial Demo Data...'
\i seed_data.sql

\echo '---------------------------------------------------'
\echo 'Database initialization complete!'
\echo '---------------------------------------------------'
