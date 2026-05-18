import xml.etree.ElementTree as ET
import pandas as pd
import os

TARGET_METRICS = {
    'HKCategoryTypeIdentifierSleepAnalysis',
    'HKQuantityTypeIdentifierStepCount',
    'HKQuantityTypeIdentifierActiveEnergyBurned',
}

def parse_apple_health_xml(file_path):
    if not os.path.exists(file_path):
        return []

    records = []
    
    try:
        # Stream-parse: handle each <Record> as it appears, then discard it
        context = ET.iterparse(file_path, events=('end',))
        
        for event, elem in context:
            if elem.tag != 'Record':
                continue
            
            r_type = elem.get('type')
            if r_type not in TARGET_METRICS:
                elem.clear()  # CRITICAL: free memory
                continue
            
            try:
                s_date = pd.to_datetime(elem.get('startDate'))
                e_date = pd.to_datetime(elem.get('endDate'))
                
                val = elem.get('value')
                unit = elem.get('unit', '')
                
                if r_type == 'HKCategoryTypeIdentifierSleepAnalysis':
                    duration = (e_date - s_date).total_seconds() / 3600
                    val = round(duration, 2)
                    unit = 'Hours'
                else:
                    try:
                        val = float(val)
                    except:
                        val = 0.0
                
                records.append({
                    'type': r_type,
                    'value': val,
                    'unit': unit,
                    'startDate': s_date.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                    'endDate':   e_date.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                })
            except Exception:
                pass  # skip malformed records
            finally:
                elem.clear()  # CRITICAL: free memory after processing
        
        return records
    
    except Exception as e:
        print(f"Error parsing XML: {e}", flush=True)
        return []