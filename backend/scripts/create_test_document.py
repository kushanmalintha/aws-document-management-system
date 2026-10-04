from app.db.database import SessionLocal
from app.models.document import Document
from app.models.user import User


def main():
    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.email == "foldertest@example.com")
            .first()
        )

        if user is None:
            raise RuntimeError(
                "Test user not found. Register the test user first."
            )

        document = Document(
            user_id=user.id,
            folder_id=None,
            name="AWS Test Document.pdf",
            content_type="application/pdf",
            size_bytes=1024,
            current_version=1,
            s3_key=None,
            status="PENDING_UPLOAD",
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        print(f"Created test document: {document.id}")

    finally:
        db.close()


if __name__ == "__main__":
    main()