import sys
import os
import pyzipper

def set_password_for_existing_zip(input_zip, output_zip, password):
    with pyzipper.AESZipFile(input_zip, 'r') as original_zip:
        with pyzipper.AESZipFile(output_zip, 'w', compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as new_zip:
            # Set the password for the entire zip file
            new_zip.setpassword(password.encode())

            # Copy the contents from the original zip file to the new zip file
            for file_info in original_zip.infolist():
                with original_zip.open(file_info) as original_file:
                    new_zip.writestr(file_info.filename, original_file.read())
# Remove the original zip file
    try:
        os.remove(input_zip)
        print(f"Original file {input_zip} deleted successfully.")
    except OSError as e:
        print(f"Error deleting original file {input_zip}: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python script.py input_zip output_zip password")
        sys.exit(1)

    input_zip = sys.argv[1]
    output_zip = sys.argv[2]
    password = sys.argv[3]

    set_password_for_existing_zip(input_zip, output_zip, password)
