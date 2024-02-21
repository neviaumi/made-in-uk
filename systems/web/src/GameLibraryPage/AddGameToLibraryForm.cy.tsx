import { cy, describe, it } from '@busybox/cypress';
import { useForm } from 'react-hook-form';

import {
  aliasMutation,
  hasOperationName,
  testGraphqlUrl,
} from '../../cypress/support/graphql-test-utils.ts';
import AddGameToLibraryModalTrigger, {
  GameBoxArtUploadField,
} from './AddGameToLibraryForm.tsx';

describe('GameBoxArtUploadField', () => {
  function TestGameBoxArtUploadField() {
    const { control } = useForm({
      defaultValues: {
        boxArtImageUrl: '',
      },
      mode: 'onBlur',
    });
    return (
      <form>
        {/* @ts-expect-error - We don't need to pass all the props to test this component*/}
        <GameBoxArtUploadField control={control} />
      </form>
    );
  }
  it('should trigger preSign mutation and upload file to the result url when upload from filed', () => {
    cy.fixture('cat-ok.png').as('cat-ok');
    cy.intercept('POST', testGraphqlUrl, req => {
      if (hasOperationName(req, 'uploadBoxArt')) {
        aliasMutation(req, 'uploadBoxArt');
        req.reply({
          body: {
            data: {
              prepareUploadGameBoxArt: {
                id: '1234',
                resultPublicUrl: 'http://asset/images/200.jpg',
                uploadUrl: 'http://asset/images',
              },
            },
          },
          statusCode: 200,
        });
      }
    });
    cy.intercept('GET', 'http://asset/images/200.jpg', {
      fixture: 'cat-ok.png',
    });
    cy.intercept('PUT', 'http://asset/images', {
      body: {
        message: 'OK',
      },
      statusCode: 200,
    }).as('assetUpload');
    cy.mount(<TestGameBoxArtUploadField />);
    cy.findByTestId('game-box-art-file-upload-raw-upload-input').selectFile(
      '@cat-ok',
      {
        force: true,
      },
    );
    cy.wait('@assetUpload');
    cy.findByRole('img', {
      name: 'boxArtImageUrlValue',
    }).should('be.visible');
  });
});

describe('AddGameToLibraryForm', () => {
  it('should not trigger the callback when cancel button is clicked', () => {
    const onAddGameToLibrary = cy.stub().as('onAddGameToLibrary');
    cy.mount(
      <AddGameToLibraryModalTrigger
        onGameCreatedOnLibrary={onAddGameToLibrary}
      />,
    );
    cy.findByRole('button', { name: 'Add Game to Library' }).click();
    cy.findByRole('article', {
      name: 'Add game to your library',
    }).should('be.visible');
    cy.findByRole('button', { name: 'Cancel' }).click();
    cy.findByRole('article', {
      name: 'Add game to your library',
    }).should('be.not.exist');
    cy.wrap(onAddGameToLibrary).should('not.have.been.called');
  });
  it('should trigger mutation when submit the form', () => {
    cy.fixture('cat-ok.png').as('cat-ok');
    cy.intercept('POST', testGraphqlUrl, req => {
      if (hasOperationName(req, 'uploadBoxArt')) {
        aliasMutation(req, 'uploadBoxArt');
        req.reply({
          body: {
            data: {
              prepareUploadGameBoxArt: {
                id: '1234',
                resultPublicUrl: 'http://asset/images/200.jpg',
                uploadUrl: 'http://asset/images',
              },
            },
          },
          statusCode: 200,
        });
      }
      if (hasOperationName(req, 'addGameToLibrary')) {
        aliasMutation(req, 'addGameToLibrary');
        req.reply({
          body: {
            data: {
              addGameToLibrary: {
                id: '1234',
              },
            },
          },
          statusCode: 200,
        });
      }
    });
    cy.intercept('GET', 'http://asset/images/200.jpg', {
      fixture: 'cat-ok.png',
    });
    cy.intercept('PUT', 'http://asset/images', {
      body: {
        message: 'OK',
      },
      statusCode: 200,
    }).as('assetUpload');
    const onAddGameToLibrary = cy.stub().as('onAddGameToLibrary');
    cy.mount(
      <AddGameToLibraryModalTrigger
        onGameCreatedOnLibrary={onAddGameToLibrary}
      />,
    );
    cy.findByRole('button', { name: 'Add Game to Library' }).click();
    cy.findByTestId('game-box-art-file-upload-raw-upload-input').selectFile(
      '@cat-ok',
      {
        force: true,
      },
    );
    cy.wait('@assetUpload');
    cy.findByRole('img', {
      name: 'boxArtImageUrlValue',
    }).should('be.visible');
    cy.findByRole('textbox', {
      name: 'Name',
    }).type('Cat is Good');
    cy.findByRole('textbox', {
      name: 'Publisher',
    }).type('Cat Corp');
    cy.findByRole('combobox', {
      name: 'Platform',
    }).click();
    cy.findByRole('option', {
      name: 'PS4',
    }).click();
    cy.findByRole('spinbutton', {
      name: 'Number of Players',
    }).type('1');
    cy.findByRole('combobox', {
      name: 'Genre',
    }).click();
    cy.findByRole('option', {
      name: 'RPG',
    }).click();
    cy.findByLabelText('Release Date').type('2020-04-01');
    cy.findByRole('button', {
      name: 'Submit',
    }).click({
      force: true,
    });
    cy.wait('@gqlAddGameToLibraryMutation')
      .its('request.body.variables.data')
      .should('deep.eq', {
        boxArtImageUrl: 'http://asset/images/200.jpg',
        genre: 'RPG',
        name: 'Cat is Good',
        numberOfPlayers: 1,
        platform: 'PS4',
        publisher: 'Cat Corp',
        releaseDate: '2020-04-01',
        userId: '1ec57d7a-67be-42d0-8a97-07e743e6efbc',
      });
    cy.wrap(onAddGameToLibrary).should('have.been.calledOnce');
  });
});
