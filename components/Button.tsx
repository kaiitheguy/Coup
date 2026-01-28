import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyle = "px-4 py-3 rounded-lg font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-md",
    secondary: "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-md",
    ghost: "bg-transparent text-slate-500 hover:text-slate-900"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};