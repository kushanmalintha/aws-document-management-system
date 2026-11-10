import unittest
from types import SimpleNamespace

from sqlalchemy.engine import make_url

from app.db.database import build_database_url


class DatabaseUrlTests(unittest.TestCase):
    def test_url_preserves_credentials_containing_reserved_characters(self):
        config = SimpleNamespace(
            postgres_user="dms user",
            postgres_password="p@ss:/?#[]%word",
            postgres_host="localhost",
            postgres_port=5432,
            postgres_db="dms_test",
        )

        url = build_database_url(config)
        rendered = url.render_as_string(hide_password=False)
        parsed = make_url(rendered)

        self.assertEqual(parsed.drivername, "postgresql+psycopg")
        self.assertEqual(parsed.username, config.postgres_user)
        self.assertEqual(parsed.password, config.postgres_password)
        self.assertEqual(parsed.host, config.postgres_host)
        self.assertEqual(parsed.port, config.postgres_port)
        self.assertEqual(parsed.database, config.postgres_db)

    def test_password_is_hidden_by_default_string_representation(self):
        config = SimpleNamespace(
            postgres_user="dms_user", postgres_password="private-password",
            postgres_host="localhost", postgres_port=5432, postgres_db="dms_test",
        )
        self.assertNotIn("private-password", str(build_database_url(config)))


if __name__ == "__main__":
    unittest.main()
