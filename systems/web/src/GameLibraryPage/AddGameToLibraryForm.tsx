import { gql, useMutation } from '@apollo/client';
import { Button } from '@busybox/react-components/Button';
import { DateInput } from '@busybox/react-components/DateInput';
import { FileUploadInput } from '@busybox/react-components/FileUploadInput';
import { Field } from '@busybox/react-components/FormField/Field';
import { FieldErrorMessage } from '@busybox/react-components/FormField/FieldErrorMessage';
import { Label } from '@busybox/react-components/FormField/Label';
import { Image } from '@busybox/react-components/Image';
import {
  Modal,
  ModalContent,
  ModalTitle,
} from '@busybox/react-components/Modal';
import { NumberInput } from '@busybox/react-components/NumberInput';
import { Select, SelectOption } from '@busybox/react-components/Select';
import { Skeleton } from '@busybox/react-components/Skeleton';
import { TextInput } from '@busybox/react-components/TextInput';
import { withCheckNewValueIsNotEqual } from '@busybox/react-components/utils/with-check-new-value-is-not-equal';
import clsx from 'clsx';
import {
  type ChangeEvent,
  type PropsWithChildren,
  type PropsWithoutRef,
  type ReactElement,
  useState,
} from 'react';
import {
  type Control,
  Controller,
  useController,
  useForm,
} from 'react-hook-form';

type AddGameToLibraryFormValues = {
  boxArtImageUrl: string;
  genre: string;
  name: string;
  numberOfPlayers: string;
  platform: string;
  publisher: string;
  releaseDate: string | null;
};

function FieldWithLoading({
  children,
  loading,
  skeleton,
}: PropsWithChildren<{
  loading: boolean;
  skeleton: ReactElement;
}>) {
  if (loading) return skeleton;
  return children;
}

export function GameBoxArtUploadField({
  control,
}: PropsWithoutRef<{
  control: Control<AddGameToLibraryFormValues>;
}>) {
  const PREPARE_UPLOAD_GAME_BOX_ART = gql`
    mutation uploadBoxArt($fileName: String!) {
      prepareUploadGameBoxArt(fileName: $fileName) {
        id
        resultPublicUrl
        uploadUrl
      }
    }
  `;
  const [
    prePareUploadGameBoxArt,
    { loading: prePareUploadGameBoxArtMutationLoading },
  ] = useMutation(PREPARE_UPLOAD_GAME_BOX_ART);
  const { field, fieldState, formState } = useController({
    control: control,
    name: 'boxArtImageUrl',
    rules: {
      required: 'box art must be provided',
    },
  });
  const { disabled, name, onBlur, onChange, ref, value } = field;
  const { error, invalid, isDirty } = fieldState;
  const { isSubmitted, isSubmitting } = formState;
  const shouldConsiderInvalidAsError = isSubmitted || isDirty;

  const uploadFileWhenInputChanged = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const [sourceFile]: FileList | Array<null> = event.target.files ?? [];
    if (!sourceFile) return;
    const { data, errors } = await prePareUploadGameBoxArt({
      variables: { fileName: sourceFile.name },
    });
    if (errors) return;
    await fetch(data.prepareUploadGameBoxArt.uploadUrl, {
      body: sourceFile,
      method: 'PUT',
    });
    onChange(data.prepareUploadGameBoxArt.resultPublicUrl);
  };
  return (
    <Field
      className={'tw-flex tw-flex-col tw-justify-center tw-gap-0.5'}
      disabled={disabled}
      error={invalid}
      name={name}
      onBlur={onBlur}
      onChange={uploadFileWhenInputChanged}
      required
      value={value}
    >
      <FieldWithLoading
        loading={isSubmitting || prePareUploadGameBoxArtMutationLoading}
        skeleton={<Skeleton className={'tw-h-5 tw-w-full'} />}
      >
        {value && (
          <div className={'tw-flex tw-justify-center'}>
            <Image
              alt={`${name}Value`}
              className="tw-w-full"
              data-testid="uploaded-image"
              src={value}
            />
          </div>
        )}

        <FileUploadInput
          className={clsx(
            'tw-items-center tw-justify-center',
            shouldConsiderInvalidAsError
              ? 'group-invalid:tw-border-error group-invalid:tw-bg-error group-invalid:tw-text-error'
              : 'group-invalid:tw-border-warning group-invalid:tw-bg-white group-invalid:tw-text-warning',
            'group-invalid:hover:tw-border-primary-user-action group-invalid:hover:tw-bg-primary-user-action group-invalid:hover:tw-text-primary-user-action',
          )}
          data-testid={'game-box-art-file-upload'}
          ref={ref}
        >
          Upload Box Art{value && ' Again'}
        </FileUploadInput>
      </FieldWithLoading>
      <FieldErrorMessage className={'tw-text-error'}>
        {error?.message}
      </FieldErrorMessage>
    </Field>
  );
}

function AddGameToLibraryModal({
  onModalClose,
  open,
}: {
  onModalClose?: (e: any, reason: string) => void;
  open: boolean;
}) {
  const ADD_GAME_TO_LIST = gql`
    mutation addGameToLibrary($data: AddGameToLibraryArgs!) {
      addGameToLibrary(data: $data) {
        id
      }
    }
  `;
  const [createGameMutation] = useMutation(ADD_GAME_TO_LIST);

  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
  } = useForm<AddGameToLibraryFormValues>({
    defaultValues: {
      name: '',
      publisher: '',
    },
    mode: 'onChange',
    shouldUseNativeValidation: true,
  });
  const submitFormValues = async (values: AddGameToLibraryFormValues) => {
    const data = {
      ...values,
      // Hardcoded user id for easily isolate records in DB
      userId: '1ec57d7a-67be-42d0-8a97-07e743e6efbc',
    };
    try {
      await createGameMutation({
        variables: {
          data,
        },
      });
    } catch (e) {
      return;
    }
    onModalClose?.(
      new CustomEvent('gameCreatedInLibrary', {
        detail: {
          gameCreated: data,
        },
      }),
      'submit',
    );
  };
  return (
    <Modal
      data-testid={'add-game-to-library-modal'}
      onClose={onModalClose}
      open={open}
    >
      <ModalTitle>Add game to your library</ModalTitle>
      <ModalContent className={'tw-w-full'}>
        <form
          className={'tw-flex tw-w-full tw-flex-col tw-justify-start'}
          noValidate
          onSubmit={handleSubmit(submitFormValues)}
        >
          <GameBoxArtUploadField control={control} />
          <Controller
            control={control}
            name={'name'}
            render={({ field, fieldState, formState }) => {
              const { disabled, name, onBlur, onChange, ref, value } = field;
              const { error, invalid, isDirty } = fieldState;
              const { isSubmitted } = formState;
              const shouldConsiderInvalidAsError = isSubmitted || isDirty;
              return (
                <Field
                  className={'tw-flex tw-flex-col tw-gap-0.5'}
                  disabled={disabled}
                  error={invalid}
                  name={name}
                  onBlur={onBlur}
                  onChange={onChange}
                  required
                  value={value}
                >
                  <Label
                    className={clsx(
                      shouldConsiderInvalidAsError
                        ? 'group-invalid:tw-text-error'
                        : 'group-invalid:tw-text-warning',
                      'after:tw-content-["_*"]',
                    )}
                  >
                    Name
                  </Label>
                  <FieldWithLoading
                    loading={isSubmitting}
                    skeleton={<Skeleton className={'tw-h-5 tw-w-full'} />}
                  >
                    <TextInput
                      data-testid={'game-name-input'}
                      ref={ref}
                      slotProps={{
                        input: {
                          className: shouldConsiderInvalidAsError
                            ? 'invalid:tw-border-error'
                            : 'invalid:tw-border-warning',
                          placeholder: 'Enter game name',
                        },
                      }}
                    />
                  </FieldWithLoading>
                  <FieldErrorMessage className={'tw-text-error'}>
                    {error?.message}
                  </FieldErrorMessage>
                </Field>
              );
            }}
            rules={{
              required: 'name must be provided',
            }}
          />
          <Controller
            control={control}
            name={'publisher'}
            render={({ field, fieldState, formState }) => {
              const { disabled, name, onBlur, onChange, ref, value } = field;
              const { error, invalid, isDirty } = fieldState;
              const { isSubmitted } = formState;
              const shouldConsiderInvalidAsError = isSubmitted || isDirty;
              return (
                <Field
                  className={'tw-flex tw-flex-col tw-gap-0.5'}
                  disabled={disabled}
                  error={invalid}
                  name={name}
                  onBlur={onBlur}
                  onChange={onChange}
                  required
                  value={value}
                >
                  <Label
                    className={clsx(
                      shouldConsiderInvalidAsError
                        ? 'group-invalid:tw-text-error'
                        : 'group-invalid:tw-text-warning',
                      'after:tw-content-["_*"]',
                    )}
                  >
                    Publisher
                  </Label>
                  <FieldWithLoading
                    loading={isSubmitting}
                    skeleton={<Skeleton className={'tw-h-5 tw-w-full'} />}
                  >
                    <TextInput
                      data-testid={'game-publisher-input'}
                      ref={ref}
                      slotProps={{
                        input: {
                          className: shouldConsiderInvalidAsError
                            ? 'invalid:tw-border-error'
                            : 'invalid:tw-border-warning',
                          placeholder: 'Enter publisher of game',
                        },
                      }}
                    />
                  </FieldWithLoading>
                  <FieldErrorMessage className={'tw-text-error'}>
                    {error?.message}
                  </FieldErrorMessage>
                </Field>
              );
            }}
            rules={{
              required: 'publisher must be provided',
            }}
          />
          <Controller
            control={control}
            name={'platform'}
            render={({ field, fieldState, formState }) => {
              const { disabled, name, onBlur, onChange, ref, value } = field;
              const { error, invalid, isDirty } = fieldState;
              const { isSubmitted } = formState;
              const shouldShowAsError = isSubmitted || isDirty;
              return (
                <Field
                  className={'tw-flex tw-flex-col tw-gap-0.5'}
                  disabled={disabled}
                  error={invalid}
                  name={name}
                  onBlur={onBlur}
                  onChange={withCheckNewValueIsNotEqual(value)(onChange)}
                  required
                  value={value}
                >
                  <Label
                    className={clsx(
                      shouldShowAsError
                        ? 'group-invalid:tw-text-error'
                        : 'group-invalid:tw-text-warning',
                      'after:tw-content-["_*"]',
                    )}
                  >
                    Platform
                  </Label>

                  <FieldWithLoading
                    loading={isSubmitting}
                    skeleton={<Skeleton className={'tw-h-5 tw-w-full'} />}
                  >
                    <Select
                      data-testid={'game-platform-input'}
                      placeholder={'Select platform'}
                      ref={ref}
                      slotProps={{
                        listbox: {
                          className: 'tw-w-60 tw-bg-white',
                          'data-testid': 'form-stories-select-options',
                        },
                        popup: {
                          className: 'tw-z-20',
                        },
                        root: {
                          className: clsx(
                            'tw-h-5 tw-w-full tw-text-left',
                            shouldShowAsError
                              ? 'group-invalid:tw-border-error group-invalid:tw-text-error'
                              : 'group-invalid:tw-border-warning group-invalid:tw-text-placeholder',
                          ),
                        },
                      }}
                    >
                      <SelectOption
                        data-testid={'game-platform-input-ps4'}
                        value={'PS4'}
                      >
                        PS4
                      </SelectOption>
                      <SelectOption
                        data-testid={'game-platform-input-ps5'}
                        value={'PS5'}
                      >
                        PS5
                      </SelectOption>
                    </Select>
                  </FieldWithLoading>
                  <FieldErrorMessage className={'tw-text-error'}>
                    {error?.message}
                  </FieldErrorMessage>
                </Field>
              );
            }}
            rules={{
              required: 'platform must be provided',
            }}
          />
          <Controller
            control={control}
            name={'numberOfPlayers'}
            render={({ field, fieldState, formState }) => {
              const { disabled, name, onBlur, onChange, ref, value } = field;
              const { error, invalid, isDirty } = fieldState;
              const { isSubmitted } = formState;
              const shouldConsiderInvalidAsError = isSubmitted || isDirty;

              return (
                <Field
                  className={'tw-flex tw-flex-col tw-gap-0.5'}
                  disabled={disabled}
                  error={invalid}
                  name={name}
                  onBlur={onBlur}
                  onChange={e => onChange(parseInt(e.target.value, 10))}
                  required
                  value={value}
                >
                  <Label
                    className={clsx(
                      shouldConsiderInvalidAsError
                        ? 'group-invalid:tw-text-error'
                        : 'group-invalid:tw-text-warning',
                      'after:tw-content-["_*"]',
                    )}
                  >
                    Number of Players
                  </Label>
                  <FieldWithLoading
                    loading={isSubmitting}
                    skeleton={<Skeleton className={'tw-h-5 tw-w-full'} />}
                  >
                    <NumberInput
                      data-testid={'game-number-of-players-input'}
                      placeholder={'Enter number of players'}
                      ref={ref}
                      slotProps={{
                        input: {
                          className: shouldConsiderInvalidAsError
                            ? 'invalid:tw-border-error'
                            : 'invalid:tw-border-warning',
                          min: 1,
                        },
                      }}
                    />
                  </FieldWithLoading>
                  <FieldErrorMessage className={'tw-text-error'}>
                    {error?.message}
                  </FieldErrorMessage>
                </Field>
              );
            }}
            rules={{
              required: 'number of player be provided',
              validate: (value: string) => {
                if (isNaN(parseInt(value, 10))) {
                  return 'number of player must be a number';
                }
                return true;
              },
            }}
          />
          <Controller
            control={control}
            name={'genre'}
            render={({ field, fieldState, formState }) => {
              const { disabled, name, onBlur, onChange, ref, value } = field;
              const { error, invalid, isDirty } = fieldState;
              const { isSubmitted } = formState;
              const shouldConsiderInvalidAsError = isSubmitted || isDirty;

              return (
                <Field
                  className={'tw-flex tw-flex-col tw-gap-0.5'}
                  disabled={disabled}
                  error={invalid}
                  name={name}
                  onBlur={onBlur}
                  onChange={withCheckNewValueIsNotEqual(value)(onChange)}
                  required
                  value={value}
                >
                  <Label
                    className={clsx(
                      shouldConsiderInvalidAsError
                        ? 'group-invalid:tw-text-error'
                        : 'group-invalid:tw-text-warning',
                      'after:tw-content-["_*"]',
                    )}
                  >
                    Genre
                  </Label>
                  <FieldWithLoading
                    loading={isSubmitting}
                    skeleton={<Skeleton className={'tw-h-5 tw-w-full'} />}
                  >
                    <Select
                      data-testid={'game-genre-input'}
                      placeholder={'Select genre'}
                      ref={ref}
                      slotProps={{
                        listbox: {
                          className: 'tw-w-60 tw-bg-white',
                          'data-testid': 'form-stories-select-options',
                        },
                        popup: {
                          className: 'tw-z-20',
                        },
                        root: {
                          className: clsx(
                            'tw-h-5 tw-w-full tw-text-left',
                            shouldConsiderInvalidAsError
                              ? 'group-invalid:tw-border-error group-invalid:tw-text-error'
                              : 'group-invalid:tw-border-warning group-invalid:tw-text-placeholder',
                          ),
                        },
                      }}
                    >
                      <SelectOption
                        data-testid={'game-genre-input-fighting'}
                        value={'FIGHTING'}
                      >
                        Fighting
                      </SelectOption>
                      <SelectOption
                        data-testid={'game-genre-input-fps'}
                        value={'FPS'}
                      >
                        FPS
                      </SelectOption>
                      <SelectOption
                        data-testid={'game-genre-input-rpg'}
                        value={'RPG'}
                      >
                        RPG
                      </SelectOption>
                      <SelectOption
                        data-testid={'game-genre-input-srpg'}
                        value={'SRPG'}
                      >
                        SRPG
                      </SelectOption>
                      <SelectOption
                        data-testid={'game-genre-input-action'}
                        value={'ACTION'}
                      >
                        ACTION
                      </SelectOption>
                    </Select>
                  </FieldWithLoading>
                  <FieldErrorMessage className={'tw-text-error'}>
                    {error?.message}
                  </FieldErrorMessage>
                </Field>
              );
            }}
            rules={{
              required: 'genre must be provided',
            }}
          />
          <Controller
            control={control}
            name={'releaseDate'}
            render={({ field, fieldState, formState }) => {
              const { disabled, name, onBlur, onChange, ref, value } = field;
              const { error, invalid, isDirty } = fieldState;
              const { isSubmitted } = formState;
              const shouldConsiderInvalidAsError = isSubmitted || isDirty;
              return (
                <Field
                  className={'tw-flex tw-flex-col tw-gap-0.5'}
                  disabled={disabled}
                  error={invalid}
                  name={name}
                  onBlur={onBlur}
                  onChange={onChange}
                  required
                  value={value}
                >
                  <Label
                    className={clsx(
                      shouldConsiderInvalidAsError
                        ? 'group-invalid:tw-text-error'
                        : 'group-invalid:tw-text-warning',
                      'after:tw-content-["_*"]',
                    )}
                  >
                    Release Date
                  </Label>
                  <FieldWithLoading
                    loading={isSubmitting}
                    skeleton={<Skeleton className={'tw-h-5 tw-w-full'} />}
                  >
                    <DateInput
                      data-testid={'game-release-date-input'}
                      ref={ref}
                      slotProps={{
                        input: {
                          className: clsx(
                            shouldConsiderInvalidAsError
                              ? 'invalid:tw-border-error invalid:tw-text-error'
                              : 'invalid:tw-border-warning invalid:tw-text-placeholder',
                          ),
                        },
                      }}
                    />
                  </FieldWithLoading>
                  <FieldErrorMessage className={'tw-text-error'}>
                    {error?.message}
                  </FieldErrorMessage>
                </Field>
              );
            }}
            rules={{
              required: 'release date must be provided',
            }}
          />
          <footer className={'tw-mb-1 tw-mt-2 tw-flex tw-justify-end tw-gap-2'}>
            <Button data-testid={'game-submit'} type={'submit'}>
              Submit
            </Button>
            <Button
              data-testid={'cancel-game-submit'}
              onClick={e => {
                onModalClose?.(e, 'cancel');
              }}
            >
              Cancel
            </Button>
          </footer>
        </form>
      </ModalContent>
    </Modal>
  );
}
function isSubmitEvent(
  _e: unknown,
  reason: string,
): _e is CustomEvent<{ gameCreated: AddGameToLibraryFormValues }> {
  return reason === 'submit';
}

function AddGameToLibraryModalTrigger({
  onGameCreatedOnLibrary,
}: {
  onGameCreatedOnLibrary: (
    data: AddGameToLibraryFormValues,
  ) => Promise<void> | void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const onModalClose = (e: Event, reason: 'submit' | 'cancel' | string) => {
    setModalOpen(false);
    if (isSubmitEvent(e, reason)) {
      onGameCreatedOnLibrary(e.detail.gameCreated);
    }
  };
  return (
    <>
      <Button
        data-testid={'add-game-to-library'}
        onClick={() => setModalOpen(true)}
      >
        Add Game to Library
      </Button>
      {modalOpen && (
        <AddGameToLibraryModal onModalClose={onModalClose} open={modalOpen} />
      )}
    </>
  );
}

export default AddGameToLibraryModalTrigger;
