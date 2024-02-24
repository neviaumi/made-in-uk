import type { MetaFunction } from "@remix-run/node";
import {json } from "@remix-run/node";
import {useLoaderData} from "@remix-run/react";
import gql from 'graphql-tag'
import {print} from 'graphql'
export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export async function loader ()  {
  const {
    webApiHost
  } = {webApiHost: process.env['WEB_API_HOST']!}
  if (!webApiHost) throw new Error('webApiHost is not defined');
  const resp = await fetch(new URL('/graphql', webApiHost).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: print(gql`
      query getVisitCount {
        visitCount {
            count
        }
      }
      `)
    })
  }).then(res => res.json());
  return json(resp);
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>()
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Welcome to Remix</h1>
      <ul>
        <li>
          <pre>{JSON.stringify(loaderData, null, 4)}
          </pre>
        </li>
      </ul>
    </div>
  );
}
