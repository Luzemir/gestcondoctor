import os
import certifi
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# The user already provided the psycopg2 connection string in previous scripts? Let's check environment.
# Often Supabase connection string is in SUPABASE_DB_URL or we construct it.
DB_USER = "postgres"
DB_PASS = os.getenv("SUPABASE_KEY") # Sometimes users use the key as pass, or they have a DB_PASSWORD
SUPABASE_URL = os.getenv("SUPABASE_URL")

# Actually, the safest and guaranteed way for the user to apply DDL in Supabase 
# is by pasting the SQL into their Supabase Dashboard SQL Editor, because we don't have the explicit 
# postgresql:// connection string with the database password in the .env (only the REST ANON KEY).
