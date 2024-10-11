import { NavLink } from '@remix-run/react';

export function NavBar() {
  return (
    <nav>
      <ol className={'tw-flex tw-flex-row tw-gap-0.5 tw-py-1'}>
        <li>
          <NavLink
            className={({ isActive }) => {
              const classes = [
                'tw-block tw-px-2 tw-py-1 tw-rounded-xl hover:tw-outline hover:tw-outline-1 hover:tw-outline-emerald-300 hover:tw-text-primary-user-action tw-text-primary',
              ];
              if (isActive) classes.push('tw-bg-primary tw-font-semibold');
              return classes.join(' ');
            }}
            to={'/mall'}
          >
            Mall
          </NavLink>
        </li>
        <li>
          <NavLink
            className={({ isActive }) => {
              const classes = [
                'tw-block tw-px-2 tw-py-1 tw-rounded-xl hover:tw-outline hover:tw-outline-1 hover:tw-outline-emerald-300 hover:tw-text-primary-user-action tw-text-primary',
              ];
              if (isActive) classes.push('tw-bg-primary tw-font-semibold');
              return classes.join(' ');
            }}
            to={'/deal-monitor'}
          >
            Deal Monitors
          </NavLink>
        </li>
      </ol>
    </nav>
  );
}
