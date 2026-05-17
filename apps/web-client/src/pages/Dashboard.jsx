import DataGate from '../features/import-data/DataGate';
import DashboardPage from '../features/dashboard/DashboardPage';

export default function Dashboard() {
    return (
        <DataGate mode="dashboard">
            <DashboardPage />
        </DataGate>
    );
}