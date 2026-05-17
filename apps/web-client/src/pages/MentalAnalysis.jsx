import DataGate from '../features/import-data/DataGate';
import MentalAnalysisPage from '../features/mental/MentalAnalysisPage';

export default function MentalAnalysis() {
    return (
        <DataGate mode="mental">
            <MentalAnalysisPage />
        </DataGate>
    );
}