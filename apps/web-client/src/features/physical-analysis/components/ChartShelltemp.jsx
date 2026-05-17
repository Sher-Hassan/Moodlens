import Card from './Card';
import './ChartShell.css';

/**
 * Standard wrapper: title row, optional control slot, fixed-height chart area,
 * and an auto-generated insight line at the bottom.
 */
export default function ChartShell({
    title,
    subtitle,
    insight,
    controls,
    height = 320,
    span = 1,
    isEmpty = false,
    emptyLabel = 'Not enough data yet.',
    children,
}) {
    return (
        <Card span={span}>
            <header className="cs-head">
                <div className="cs-titles">
                    <h3 className="cs-title">{title}</h3>
                    {subtitle && <p className="cs-subtitle">{subtitle}</p>}
                </div>
                {controls && <div className="cs-controls">{controls}</div>}
            </header>

            <div className="cs-body" style={{ height }}>
                {isEmpty ? (
                    <div className="cs-empty">
                        <span className="cs-empty-dot" />
                        <p>{emptyLabel}</p>
                    </div>
                ) : (
                    children
                )}
            </div>

            {insight && !isEmpty && (
                <p className="cs-insight">
                    <span className="cs-insight-mark" aria-hidden="true">↳</span>
                    {insight}
                </p>
            )}
        </Card>
    );
}