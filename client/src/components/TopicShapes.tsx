/**
 * TopicShapes - Different SVG shapes for different topic types
 * 
 * Shape mapping:
 * - Triangle → Grammar topics (verb tenses, conjugation)
 * - Hexagon → Functional topics (ordering food, asking directions)
 * - Rounded Square → Subject content (family, travel, food)
 * - Star → Cultural insights (customs, holidays, idioms)
 * - Circle → Default/mixed topics
 */

export type ShapeType = 'triangle' | 'hexagon' | 'square' | 'star' | 'circle';

interface TopicShapeProps {
  x: number;
  y: number;
  size: number;
  type: ShapeType;
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  isHovered?: boolean;
  isPulsing?: boolean;
  isSparkle?: boolean;
  isAurora?: boolean;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children?: React.ReactNode;
}

function getShapePath(type: ShapeType, size: number): string {
  const half = size / 2;
  const third = size / 3;
  
  switch (type) {
    case 'triangle':
      return `M0,${size} L${half},-${half * 0.3} L${size},${size} Z`;
    
    case 'hexagon': {
      const w = size;
      const h = size * 0.866;
      return `M${w * 0.25},0 L${w * 0.75},0 L${w},${h * 0.5} L${w * 0.75},${h} L${w * 0.25},${h} L0,${h * 0.5} Z`;
    }
    
    case 'square': {
      const r = size * 0.15;
      return `M${r},0 L${size - r},0 Q${size},0 ${size},${r} L${size},${size - r} Q${size},${size} ${size - r},${size} L${r},${size} Q0,${size} 0,${size - r} L0,${r} Q0,0 ${r},0 Z`;
    }
    
    case 'star': {
      const points = 5;
      const outerR = half;
      const innerR = half * 0.4;
      let path = '';
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI / points) - Math.PI / 2;
        const px = half + r * Math.cos(angle);
        const py = half + r * Math.sin(angle);
        path += (i === 0 ? 'M' : 'L') + `${px},${py} `;
      }
      return path + 'Z';
    }
    
    case 'circle':
    default:
      return '';
  }
}

export function TopicShape({
  x,
  y,
  size,
  type,
  fill,
  fillOpacity = 1,
  stroke,
  strokeWidth = 1.5,
  isHovered = false,
  isPulsing = false,
  isSparkle = false,
  isAurora = false,
  className = '',
  onClick,
  onMouseEnter,
  onMouseLeave,
  children
}: TopicShapeProps) {
  const halfSize = size / 2;
  const id = `shape-${type}-${x}-${y}`;
  
  if (type === 'circle') {
    return (
      <g 
        transform={`translate(${x - halfSize}, ${y - halfSize})`}
        className={`cursor-pointer transition-transform duration-200 ${isHovered ? 'scale-110' : ''} ${className}`}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ transformOrigin: `${halfSize}px ${halfSize}px` }}
      >
        {isAurora && (
          <circle
            cx={halfSize}
            cy={halfSize}
            r={halfSize + 8}
            fill="none"
            stroke={fill}
            strokeWidth={3}
            opacity={0.3}
            className="animate-pulse"
          />
        )}
        {isSparkle && (
          <>
            <circle
              cx={halfSize}
              cy={halfSize}
              r={halfSize + 5}
              fill="none"
              stroke={fill}
              strokeWidth={1.5}
              strokeDasharray="3,3"
              opacity={0.5}
              className="animate-spin"
              style={{ animationDuration: '8s' }}
            />
          </>
        )}
        <circle
          cx={halfSize}
          cy={halfSize}
          r={halfSize}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          className={isPulsing ? 'animate-pulse' : ''}
        />
        {children}
      </g>
    );
  }

  const path = getShapePath(type, size);
  
  return (
    <g 
      transform={`translate(${x - halfSize}, ${y - halfSize})`}
      className={`cursor-pointer transition-transform duration-200 ${isHovered ? 'scale-110' : ''} ${className}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ transformOrigin: `${halfSize}px ${halfSize}px` }}
    >
      {isAurora && (
        <path
          d={path}
          fill="none"
          stroke={fill}
          strokeWidth={4}
          opacity={0.3}
          transform={`translate(${-2}, ${-2}) scale(1.1)`}
          className="animate-pulse"
        />
      )}
      {isSparkle && (
        <g className="animate-spin" style={{ animationDuration: '8s', transformOrigin: `${halfSize}px ${halfSize}px` }}>
          <circle cx={-3} cy={halfSize} r={2} fill={fill} opacity={0.7} />
          <circle cx={size + 3} cy={halfSize} r={2} fill={fill} opacity={0.7} />
          <circle cx={halfSize} cy={-3} r={2} fill={fill} opacity={0.7} />
          <circle cx={halfSize} cy={size + 3} r={2} fill={fill} opacity={0.7} />
        </g>
      )}
      <path
        d={path}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={isPulsing ? 'animate-pulse' : ''}
      />
      {children}
    </g>
  );
}

export function getTopicShapeType(topicType?: string, category?: string): ShapeType {
  if (topicType === 'grammar') return 'triangle';
  if (topicType === 'function') return 'hexagon';
  if (topicType === 'subject') return 'square';
  
  if (category) {
    const cat = category.toLowerCase();
    if (cat.includes('grammar') || cat.includes('verb') || cat.includes('tense') || cat.includes('conjugat')) {
      return 'triangle';
    }
    if (cat.includes('order') || cat.includes('ask') || cat.includes('request') || cat.includes('function')) {
      return 'hexagon';
    }
    if (cat.includes('culture') || cat.includes('custom') || cat.includes('holiday') || cat.includes('idiom')) {
      return 'star';
    }
  }
  
  return 'square';
}

function StaticShapeIcon({ type, color, size = 14 }: { type: ShapeType; color: string; size?: number }) {
  const half = size / 2;
  
  if (type === 'circle') {
    return <circle cx={half} cy={half} r={half} fill={color} />;
  }
  
  if (type === 'triangle') {
    return <path d={`M${half},0 L${size},${size} L0,${size} Z`} fill={color} />;
  }
  
  if (type === 'hexagon') {
    const w = size;
    const h = size * 0.866;
    return (
      <path 
        d={`M${w * 0.25},0 L${w * 0.75},0 L${w},${h * 0.5} L${w * 0.75},${h} L${w * 0.25},${h} L0,${h * 0.5} Z`} 
        fill={color} 
        transform={`translate(0, ${(size - h) / 2})`}
      />
    );
  }
  
  if (type === 'star') {
    const points = 5;
    const outerR = half;
    const innerR = half * 0.4;
    let path = '';
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI / points) - Math.PI / 2;
      const px = half + r * Math.cos(angle);
      const py = half + r * Math.sin(angle);
      path += (i === 0 ? 'M' : 'L') + `${px},${py} `;
    }
    return <path d={path + 'Z'} fill={color} />;
  }
  
  const r = size * 0.15;
  return (
    <path 
      d={`M${r},0 L${size - r},0 Q${size},0 ${size},${r} L${size},${size - r} Q${size},${size} ${size - r},${size} L${r},${size} Q0,${size} 0,${size - r} L0,${r} Q0,0 ${r},0 Z`} 
      fill={color} 
    />
  );
}

export function ShapeLegend({ className }: { className?: string }) {
  const shapes: { type: ShapeType; label: string; color: string }[] = [
    { type: 'square', label: 'Subject', color: '#6366f1' },
    { type: 'triangle', label: 'Grammar', color: '#10b981' },
    { type: 'hexagon', label: 'Function', color: '#06b6d4' },
    { type: 'star', label: 'Culture', color: '#f59e0b' },
  ];

  return (
    <div className={`flex flex-wrap gap-4 justify-center text-xs text-muted-foreground ${className}`}>
      {shapes.map(({ type, label, color }) => (
        <div key={type} className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <StaticShapeIcon type={type} color={color} size={16} />
          </svg>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
