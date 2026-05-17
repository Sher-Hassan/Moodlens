import Card from './Card';
import InfoTooltip from './InfoTooltip';
import './ChartShell.css';

/**
 * Standard wrapper: title row, optional info tooltip, optional control slot,
 * fixed-height chart area, and an auto-generated insight line at the bottom.
 *
 * NEW: pass `info={{ what, how, why }}` to render the ⓘ tooltip next to the title.
 */
export default function ChartShell({
    title,
    subtitle,
    insight,
    controls,
    info,
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
                    <div className="cs-title-row">
                        <h3 className="cs-title">{title}</h3>
                        {info && <InfoTooltip {...info} />}
                    </div>
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
