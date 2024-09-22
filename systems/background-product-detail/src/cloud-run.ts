const baseUrl = 'http://metadata.google.internal/';
export function getInstanceServiceAccount() {
  return fetch(
    new URL(
      'computeMetadata/v1/instance/service-accounts/default/email',
      baseUrl,
    ).toString(),
    {
      headers: {
        'Metadata-Flavor': 'Google',
      },
    },
  ).then(resp => {
    if (!resp.ok) {
      throw new Error('Failed to fetch service account');
    }
    return resp.text();
  });
}
