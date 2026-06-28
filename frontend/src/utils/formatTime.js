import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns';

export const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  return format(date, 'h:mm a');
};

export const formatChatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  
  const daysDiff = differenceInDays(new Date(), date);
  if (daysDiff < 7) {
    return format(date, 'eee'); // "Mon", "Tue", etc.
  }

  return format(date, 'MMM d'); // "Jan 12", etc.
};

export const formatLastSeen = (dateString) => {
  if (!dateString) return 'Offline';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Offline';

  try {
    return `Last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
  } catch (error) {
    return 'Offline';
  }
};

export const formatMessageDateSeparator = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'EEEE, MMM d'); // e.g. "Monday, Jan 13"
};
