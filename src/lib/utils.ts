/**
 * Utility functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PointTuple } from '@/types';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with specified precision
 */
export function formatNumber(value: number, precision: number = 3): string {
  return value.toFixed(precision);
}

/**
 * Format a number with unit
 */
export function formatWithUnit(value: number, unit: string, precision: number = 3): string {
  return `${formatNumber(value, precision)}${unit ? ' ' + unit : ''}`;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Filter duplicate points within tolerance
 */
export function filterDuplicatePoints(
  points: PointTuple[],
  tolerance: number = 1e-9
): { filtered: PointTuple[]; removed: number } {
  if (points.length === 0) {
    return { filtered: [], removed: 0 };
  }

  const filtered: PointTuple[] = [points[0]];
  let removed = 0;

  for (let i = 1; i < points.length; i++) {
    const last = filtered[filtered.length - 1];
    const dx = points[i][0] - last[0];
    const dy = points[i][1] - last[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > tolerance) {
      filtered.push(points[i]);
    } else {
      removed++;
    }
  }

  return { filtered, removed };
}

/**
 * Calculate bounding box of points
 */
export function getBoundingBox(points: PointTuple[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Generate SLDCRV content (SolidWorks curve format)
 */
export function generateSLDCRV(points: PointTuple[]): string {
  return points.map(([x, y]) => `${x},${y},0`).join('\n');
}

/**
 * Generate DXF content (ASCII polyline)
 */
export function generateDXF(points: PointTuple[], closed: boolean = true): string {
  const lines: string[] = [];

  // Header section
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009');
  lines.push('0', 'ENDSEC');

  // Entities section
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  // Polyline header
  lines.push('0', 'POLYLINE');
  lines.push('8', '0');  // Layer 0
  lines.push('66', '1');  // Vertices follow
  lines.push('70', closed ? '1' : '0');  // Closed flag

  // Vertices
  for (const [x, y] of points) {
    lines.push('0', 'VERTEX');
    lines.push('8', '0');  // Layer 0
    lines.push('10', x.toString());  // X
    lines.push('20', y.toString());  // Y
    lines.push('30', '0.0');  // Z
  }

  // End polyline
  lines.push('0', 'SEQEND');

  // End entities and file
  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\n');
}

/**
 * Download a file with the given content
 */
export function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download points as SLDCRV file
 */
export function downloadAsSLDCRV(points: PointTuple[], filename: string = 'curve.sldcrv') {
  const { filtered } = filterDuplicatePoints(points);
  const content = generateSLDCRV(filtered);
  downloadFile(filename, content);
}

/**
 * Download points as DXF file
 */
export function downloadAsDXF(points: PointTuple[], filename: string = 'curve.dxf', closed: boolean = true) {
  const { filtered } = filterDuplicatePoints(points);
  const content = generateDXF(filtered, closed);
  downloadFile(filename, content);
}

/**
 * Download config as JSON file
 */
export function downloadConfigJSON(config: object, filename: string = 'config.json') {
  const content = JSON.stringify(config, null, 2);
  downloadFile(filename, content, 'application/json');
}

/**
 * Read a JSON file and return its contents
 */
export function readJSONFile(file: File): Promise<object> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = JSON.parse(reader.result as string);
        resolve(result);
      } catch (e) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
