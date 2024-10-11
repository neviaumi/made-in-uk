import { type MetaFunction, redirect } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'Made In UK' },
    { content: 'Search product that made in UK', name: 'description' },
  ];
};

export async function loader() {
  return redirect('/mall');
}
