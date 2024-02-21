import { gql, useQuery } from '@apollo/client';
import { Card, CardTitle } from '@busybox/react-components/Card';
import { Field } from '@busybox/react-components/FormField/Field';
import { Label } from '@busybox/react-components/FormField/Label';
import { Image } from '@busybox/react-components/Image';
import { Content, Main, Side } from '@busybox/react-components/Layout';
import { List, ListItem } from '@busybox/react-components/List';
import { Radio, RadioGroup } from '@busybox/react-components/RadioGroup';
import { Skeleton } from '@busybox/react-components/Skeleton';
import { TablePagination } from '@busybox/react-components/Table/TablePagination';
import { withHiddenInput } from '@busybox/react-components/Table/withHiddenInput';
import { createEmptyComponent } from '@busybox/react-components/utils/create-empty-component';
import clsx from 'clsx';
import { type PropsWithChildren, useRef } from 'react';

import AddGameToLibraryTrigger from './AddGameToLibraryForm.tsx';

const Pagination = withHiddenInput(TablePagination);
const PAGINATION_TOTAL_COUNT = -1; // Dynamodb not support total count
const PAGINATION_CURRENT_PAGE = 1; // Dynamodb pagination expected use infinite scroll approach

interface Game {
  boxArtImageUrl: string;
  id: string;
  name: string;
  platform: string;
  publisher: string;
}

interface Data {
  gameList: {
    edges: { node: Game }[];
    pageInfo: { hasNextPage: boolean; nextPageToken: string };
    totalCount: number;
  };
}

function ListContents({
  children,
  loading,
  numberOfItems,
}: PropsWithChildren<{ loading: boolean; numberOfItems: number }>) {
  if (!loading) {
    return children;
  }
  return (
    <>
      {Array.from({ length: numberOfItems }).map((_, index) => (
        <ListItem key={index}>
          <Skeleton className={'tw-mb-0.5 tw-h-13.5 tw-w-80'} />
        </ListItem>
      ))}
    </>
  );
}

export default function GameLibraryPage() {
  const GET_GAME_LIST = gql`
    query queryGameList(
      $userId: ID
      $nextPageToken: String
      $limit: Int!
      $platform: String
    ) {
      gameList(
        userId: $userId
        nextPageToken: $nextPageToken
        limit: $limit
        platform: $platform
      ) {
        edges {
          node {
            id
            boxArtImageUrl
            platform
            name
            publisher
          }
        }
        pageInfo {
          hasNextPage
          nextPageToken
        }
      }
    }
  `;
  const searchFormRef = useRef<HTMLFormElement>(null);

  const { data, error, loading, refetch, variables } = useQuery<
    Data,
    {
      limit: number;
      nextPageToken?: string | null;
      platform?: string | null;
      userId: string;
    }
  >(GET_GAME_LIST, {
    notifyOnNetworkStatusChange: true,
    variables: {
      limit: 4,
      platform: null,
      userId: '1ec57d7a-67be-42d0-8a97-07e743e6efbc',
    },
  });
  const rowsPerPage = variables!.limit;
  const platform = variables?.platform || 'ALL';
  const hasNextPage = data?.gameList.pageInfo.hasNextPage || false;

  async function triggerContentRefresh() {
    const searchForm = searchFormRef.current;
    if (searchForm === null) {
      return;
    }
    const searchFilters = Object.fromEntries(
      new FormData(searchForm).entries(),
    );
    const selectedPage = Number(searchFilters['page']);
    const rowsPerPage = Number(searchFilters['rowsPerPage']);
    const nextPageToken =
      selectedPage !== 0 && data?.gameList.pageInfo.hasNextPage
        ? data?.gameList.pageInfo.nextPageToken
        : null;

    await refetch({
      limit: rowsPerPage,
      nextPageToken,
      platform:
        searchFilters['platform'] === 'ALL'
          ? null
          : (searchFilters['platform'] as string),
    });
  }

  function backToFirstPage() {
    const form = searchFormRef.current;
    if (form === null) {
      return;
    }
    const formElements = form.elements;
    (formElements.namedItem('page') as Element).setAttribute('value', '0');
  }

  function setPlatformFilter(platform: string) {
    const form = searchFormRef.current;
    if (form === null) {
      return;
    }
    const formElements = form.elements;
    (formElements.namedItem('platform') as Element).setAttribute(
      'value',
      platform,
    );
  }

  if (error) {
    // TODO: https://github.com/davidNHK/react-components/issues/525
    return <div>Error!</div>;
  }
  return (
    <Content className={'tw-flex tw-flex-row tw-justify-evenly'}>
      <Main>
        <h1>Saved games on {platform} platform</h1>
        <List>
          <ListContents loading={loading} numberOfItems={rowsPerPage}>
            {data?.gameList.edges.map(({ node }) => (
              <ListItem key={node.id}>
                <Card
                  className={'tw-flex tw-w-80 tw-justify-between'}
                  data-testid={`game-container`}
                >
                  <div className={'tw-inline-flex tw-items-center tw-gap-2'}>
                    <Image className={'tw-w-10'} src={node.boxArtImageUrl} />
                    <div className={'tw-flex tw-flex-col tw-content-between'}>
                      <CardTitle>{node.name}</CardTitle>
                      <p className={'tw-uppercase'}>{node.platform}</p>
                    </div>
                  </div>
                  <div
                    className={
                      'tw-inline-flex tw-items-center tw-justify-items-end'
                    }
                  >
                    <p className={'tw-uppercase'}>{node.publisher}</p>
                  </div>
                </Card>
              </ListItem>
            ))}
          </ListContents>
        </List>
        <Pagination
          count={PAGINATION_TOTAL_COUNT}
          onPageChange={() => {
            triggerContentRefresh();
          }}
          onRowsPerPageChange={() => {
            backToFirstPage();
            triggerContentRefresh();
          }}
          page={PAGINATION_CURRENT_PAGE}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[2, 4, 6, 8, 10, 100]}
          slotProps={{
            actions: {
              showLastButton: false,
              slotProps: {
                backButton: {
                  className: clsx('tw-hidden'),
                  disabled: true,
                },
                firstButton: {
                  disabled: loading,
                },
                nextButton: {
                  disabled: !hasNextPage,
                },
              },
            },
            input: {
              form: 'game-search',
              name: 'page',
            },
            select: {
              disabled: loading,
              form: 'game-search',
              name: 'rowsPerPage',
            },
          }}
          slots={{
            displayedRows: createEmptyComponent('div'),
            root: 'aside',
          }}
        />
      </Main>
      <Side>
        <AddGameToLibraryTrigger
          onGameCreatedOnLibrary={gameCreated => {
            backToFirstPage();
            setPlatformFilter(gameCreated.platform);
            triggerContentRefresh();
          }}
        />
        <search>
          <form
            id={'game-search'}
            onSubmit={e => {
              e.preventDefault();
              triggerContentRefresh();
            }}
            ref={searchFormRef}
          >
            <Field
              name={'platform'}
              onChange={() => {
                backToFirstPage();
                triggerContentRefresh();
              }}
              value={platform}
            >
              <RadioGroup>
                <Label className={'tw-block'}>Filter</Label>
                <Radio id={'ps4'} value={'PS4'}>
                  PS4
                </Radio>
                <Radio id={'ps5'} value={'PS5'}>
                  PS5
                </Radio>
                <Radio id={'all'} value={'ALL'}>
                  ALL
                </Radio>
              </RadioGroup>
            </Field>
          </form>
        </search>
      </Side>
    </Content>
  );
}
