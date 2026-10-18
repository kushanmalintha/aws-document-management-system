from io import BytesIO

from app.infrastructure.local_storage import LocalStorage


def main():
    storage = LocalStorage("test_local_storage")

    storage_key = "documents/test-document.txt"

    original_content = b"Hello from the DMS local storage layer."

    file_object = BytesIO(original_content)

    storage.save(
        file_object,
        storage_key,
    )

    print(
        "File exists after save:",
        storage.exists(storage_key),
    )

    stored_file = storage.read(storage_key)

    try:
        stored_content = stored_file.read()
    finally:
        stored_file.close()

    print(
        "Content matches:",
        stored_content == original_content,
    )

    storage.delete(storage_key)

    print(
        "File exists after delete:",
        storage.exists(storage_key),
    )


if __name__ == "__main__":
    main()