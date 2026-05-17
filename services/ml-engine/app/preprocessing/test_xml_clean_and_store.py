import os
import sys

# Ensure the parent directory is in sys.path for script execution
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.cleaner import parse_apple_health_xml


# Find any .xml file in the uploads directory
uploads_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    'api-server', 'uploads', 'xml-files'
)
xml_file_path = None
for fname in os.listdir(uploads_dir):
    if fname.lower().endswith('.xml'):
        xml_file_path = os.path.join(uploads_dir, fname)
        break

if not xml_file_path:
    raise FileNotFoundError('No .xml file found in uploads directory.')

# Clean and parse the XML data
cleaned_data = parse_apple_health_xml(xml_file_path)

# Print the cleaned data before storing to MongoDB
print('Cleaned Data:', cleaned_data)

# --- MongoDB storage logic goes here ---
# from pymongo import MongoClient
# client = MongoClient('mongodb://localhost:27017/')
# db = client['your_db_name']
# collection = db['your_collection_name']
# if cleaned_data:
#     collection.insert_many(cleaned_data)
#     print('Data inserted into MongoDB.')
# else:
#     print('No data to insert.')
