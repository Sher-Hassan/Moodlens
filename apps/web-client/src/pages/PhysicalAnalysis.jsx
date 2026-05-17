import DataGate from '../features/import-data/DataGate';
import PhysicalAnalysisPage from '../features/physical-analysis/PhysicalAnalysisPage';

export default function PhysicalAnalysis() {
    return (
        <DataGate mode="physical">
            <PhysicalAnalysisPage />
        </DataGate>
    );
}