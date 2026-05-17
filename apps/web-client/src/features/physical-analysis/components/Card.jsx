import './Card.css';

export default function Card({ children, span = 1, className = '', ...rest }) {
    return (
        <section
            className={`pa-card pa-card--span-${span} ${className}`}
            {...rest}
        >
            {children}
        </section>
    );
}