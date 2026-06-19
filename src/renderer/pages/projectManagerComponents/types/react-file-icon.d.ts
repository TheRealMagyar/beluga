declare module 'react-file-icon' {
  import { FC } from 'react';

  export interface FileIconProps {
    extension?: string;
    color?: string;
    secondaryColor?: string;
    labelColor?: string;
    labelTextColor?: string;
    glyphColor?: string;
    type?: string;
    radius?: number;
    fold?: boolean;
    foldColor?: string;
    gradientColor?: string;
    gradientOpacity?: number;
    labelUppercase?: boolean;
    [key: string]: any;
  }

  export const FileIcon: FC<FileIconProps>;
  export const defaultStyles: Record<string, Partial<FileIconProps>>;
}