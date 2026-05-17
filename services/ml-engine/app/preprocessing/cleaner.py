import xml.etree.ElementTree as ET
import pandas as pd
import os

def parse_apple_health_xml(file_path):
    if not os.path.exists(file_path):
        return []

    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        records = []
        
        target_metrics = [
            'HKCategoryTypeIdentifierSleepAnalysis',
            'HKQuantityTypeIdentifierStepCount',
            'HKQuantityTypeIdentifierActiveEnergyBurned'
        ]
        
        for record in root.findall('Record'):
            attr = record.attrib
            r_type = attr.get('type')
            
            if r_type in target_metrics:
                # Get raw dates
                s_date = pd.to_datetime(attr.get('startDate'))
                e_date = pd.to_datetime(attr.get('endDate'))
                
                # Default values
                val = attr.get('value')
                unit = attr.get('unit', '')

                # LOGIC CHANGE: If it's Sleep, calculate duration in decimal hours
                if r_type == 'HKCategoryTypeIdentifierSleepAnalysis':
                    duration = (e_date - s_date).total_seconds() / 3600 # Seconds to Hours
                    val = round(duration, 2) # e.g., 7.50
                    unit = 'Hours'
                else:
                    # For Steps and Calories, just convert the existing value to float
                    try:
                        val = float(val)
                    except:
                        val = 0.0

                records.append({
                    'type': r_type,
                    'value': val,
                    'unit': unit,
                    'startDate': s_date,
                    'endDate': e_date
                })
        
        df = pd.DataFrame(records)
        if df.empty: return []

        # Convert timestamps to ISO strings for JSON safety
        df['startDate'] = df['startDate'].dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        df['endDate'] = df['endDate'].dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        return df.to_dict(orient='records')

    except Exception as e:
        print(f"Error: {e}")
        return []