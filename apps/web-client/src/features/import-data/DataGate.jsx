import { useState } from 'react';
import { useHealthData } from '../../context/HealthDataContext';
import Spinner from '../../components/common/Spinner';
import ImportDataFlow from './ImportDataFlow';
import FloatingImportButton from './FloatingImportButton';
import './DataGate.css';

const EMPTY_TITLES = {
    dashboard: 'Your first reading is one import away.',
    physical: 'Your body has data to share.',
    mental: 'Mental analysis needs your wearable data first.',
    default: 'No health data yet.',
};

export default function DataGate({ mode = 'default', children, loadedContent }) {
    const { status } = useHealthData();
    const [importOpen, setImportOpen] = useState(false);

    // FIX: Check if the import flow is open BEFORE checking for loading status.
    // This prevents the Loading Spinner from unmounting the Import Flow.
    if (importOpen) {
        return (
            <CenterWrap>
                <ImportDataFlow
                    isUpdate={status === 'loaded'}
                    onClose={() => setImportOpen(false)}
                />
            </CenterWrap>
        );
    }
    // ─ Checking / idle ─
    if (status === 'checking' || status === 'idle') {
        return (
            <CenterWrap>
                <Spinner size="lg" label="Reading your signal…" />
            </CenterWrap>
        );
    }

    // ─ Error ─
    if (status === 'error') {
        return (
            <CenterWrap>
                <div className="data-gate__error">
                    <p className="data-gate__error-title">Couldn't reach the server.</p>
                    <p className="data-gate__error-sub">
                        Make sure the API is running, then refresh.
                    </p>
                </div>
            </CenterWrap>
        );
    }

    // ─ Import flow active (overrides empty/loaded view) ─
    if (importOpen) {
        return (
            <CenterWrap>
                <ImportDataFlow
                    isUpdate={status === 'loaded'}
                    onClose={() => setImportOpen(false)}
                />
            </CenterWrap>
        );
    }

    // ─ No data ─
    if (status === 'no-data') {
        return (
            <CenterWrap>
                <EmptyState mode={mode} onImport={() => setImportOpen(true)} />
            </CenterWrap>
        );
    }

    // ─ Loaded ─
    return (
        <div className="data-gate data-gate--loaded">
            {loadedContent ?? children}
            <FloatingImportButton onClick={() => setImportOpen(true)} />
        </div>
    );
}

function CenterWrap({ children }) {
    return <div className="data-gate data-gate--center">{children}</div>;
}

function EmptyState({ mode, onImport }) {
    const title = EMPTY_TITLES[mode] ?? EMPTY_TITLES.default;
    return (
        <div className="empty-state">
            <span className="empty-state__pulse" aria-hidden="true">
                <span className="empty-state__pulse-dot" />
                <span className="empty-state__pulse-ring" />
            </span>
            <h2 className="empty-state__title">{title}</h2>
            <p className="empty-state__sub">
                Import your Apple Health export to begin. A minute, tops.
            </p>
            <button className="empty-state__btn" onClick={onImport}>
                Import data
                <span aria-hidden="true">→</span>
            </button>
        </div>
    );
}