function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove special characters
    .replace(/\s+/g, '-') // replace spaces with dash
    .replace(/--+/g, '-'); // replace multiple dashes
}

function formatDate(date: Date): string {
  // YYYYMMDD
  const yyyy = date.getFullYear();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export async function generateUniqueSlug(
  title: string,
  blogService: { findBySlug: (slug: string) => Promise<unknown> },
): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists
  let exists = (await blogService.findBySlug(slug)) != null;

  while (exists) {
    // Add counter + date to make it unique
    const datePart = formatDate(new Date());
    slug = `${baseSlug}-${counter}-${datePart}`;
    exists = (await blogService.findBySlug(slug)) != null;
    counter++;
  }

  return slug;
}

export async function generateServiceSlug(
  name: string,
  serviceService: { findBySlug: (slug: string) => Promise<unknown> },
): Promise<string> {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists
  let exists = (await serviceService.findBySlug(slug)) != null;

  while (exists) {
    // Add counter + date to make it unique
    const datePart = formatDate(new Date());
    slug = `${baseSlug}-${counter}-${datePart}`;
    exists = (await serviceService.findBySlug(slug)) != null;
    counter++;
  }

  return slug;
}
