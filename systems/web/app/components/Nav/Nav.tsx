import { Link, NavLink } from '@remix-run/react';

export function NavBar() {
  return (
    <nav className={'tw-flex tw-flex-row tw-items-center tw-gap-4 tw-py-1'}>
      <Link to={'/'}>
        <img
          alt={'icon'}
          className={
            'tw-h-8 tw-w-8 tw-rounded-full tw-bg-gray-100 tw-object-cover lg:tw-h-16 lg:tw-w-16'
          }
          src={'/icon.png'}
        />
      </Link>

      <ol className={'tw-flex tw-flex-row tw-gap-0.5'}>
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
