export const getInitials = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getInitialsBg = (name) => {
  const char = (name || 'E').toUpperCase().charAt(0);
  const code = char.charCodeAt(0);
  const colors = ['#FF6A00', '#2563EB', '#7C3AED', '#059669', '#DC2626'];
  return colors[code % colors.length];
};

