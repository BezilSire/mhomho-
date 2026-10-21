import React, { useState, useEffect } from 'react';
import { DatabaseState, createEnquiry } from '../../lib/firebase.ts';

export interface LandingPageProps {
  db: DatabaseState;
  onCreatorApplySuccess: (newUid: string) => void;
  onOpenPortal: (role?: 'creator' | 'admin' | 'brand', uid?: string) => void;
  onOpenSignIn: () => void;
}

const WA_NUMBER = '263786205197';
const PDF_B64 =
  'JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0NvbnRlbnRzIDE0IDAgUiAvTWVkaWFCb3ggWyAwIDAgNTk1LjI3NTYgODQxLjg4OTggXSAvUGFyZW50IDEzIDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9Db250ZW50cyAxNSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCAxMyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1PYmxpcXVlIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMyAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0NvbnRlbnRzIDE2IDAgUiAvTWVkaWFCb3ggWyAwIDAgNTk1LjI3NTYgODQxLjg4OTggXSAvUGFyZW50IDEzIDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9Db250ZW50cyAxNyAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCAxMyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKOSAwIG9iago8PAovQ29udGVudHMgMTggMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgMTMgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9Db250ZW50cyAxOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCAxMyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTEgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyAxMyAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjEyIDAgb2JqCjw8Ci9BdXRob3IgKEJlemlsIFNpcmUpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjEwMTgxNjI5MzcrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjEwMTgxNjI5MzcrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKE1ob21obyBNZWRpYTogUmV0aGlua2luZyBJbmZsdWVuY2VyIERpc3RyaWJ1dGlvbiBpbiBaaW1iYWJ3ZSkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iagoxMyAwIG9iago8PAovQ291bnQgNiAvS2lkcyBbIDQgMCBSIDUgMCBSIDcgMCBSIDggMCBSIDkgMCBSIDEwIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKMTQgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjU1MQo+PgpzdHJlYW0KR2F0VTRnVEs5aCg0Rk0xJjRNMTIpPGUjblknL1pqRnBccHNrMTksXGE5c1RJMktMLUA2Vy8pNWJmQSZgVWghLDlQI0ojJDVeWGBvWzRjPSFda1BiKXI4W2VWXG10KyonRHFKbmM/UkwncDVKMFNjQ1RKc0lzWk03aGNKOkwtOCwzbyZ1WDJWUzxzI09mX3FqMmNuZyVOOEAoKHNXX0xMPTRBTCx1aUtUP2NIb1VFWlc3X0YvLilGUjlKMWxDTi9jLnNTa3MrYUptLSwxMXFDQ1AmJFYmQDxRKCdgYGUhKmpIJmJCa01MJF91OnI5PjFaQDlIMyFodTkiS2U5ZEhdQUc/Ti4qVyo8ZjgoQmkpcmtPIUpwWydDKz4rLT8saTxOcWI7N2s0KWgpIVRmcy85Zl9HJVxAa21eKVU1ZVxdJWM9WmxDJGknKilgayIsaHFTR0JxV11wXSVNR15pamNrW1RLKG8qdFJlbUlYLWxRNnA+QVUuSnBdL1BNJWMuOz0iMHBIZCRkKSJRSVtKKWImNmglIkU6WzxpTG09RmtvYjpSYTEvQS9QYl1kLUshYCgvTHVxOnNcSzpOckVCOkVcWmE3RmkkNzY3Z1lFZm1XRV9eYi1LaiU+L3VgM1ojQS1AMDksPWgmbCg9c14/TUd0VVFIImxLQnNPaEtLSiUyU2Uraj5EXEpeWSIwPVNBU2lMM2gnJG1tcjYmQ3VCKERibS9WYTRYKCtIRmA8OycyNFRAIiY7QVhRbFhpZFA7ZyZmTVMuYSliKmFKbCtuKkhdXUUuVUhjMVZeS0AtNTpYOV0nSFlzQWZuRy1DYVMzY1BedCVhTDNjbVA6X0VbLWBQUltWckZaUV1nYURfKy5VSUJTITdlQHFYbmBYT2V1bC81P2dhVjQhKVQjOiU+aGZyQzVtQGI4YS5xakE5Pzc3TCJWXmtpWDpMYF9xPSUpLkpnU3QyKi5nUEZDXldoMUJoZEhMKz5OIzhZI1U2UldDcWpkNDYuOGw2JzRUYWZSSksrNGNcXkErQFBVMiFVKS9FbFFZazNDS2g/LTNXMjZzJ1NaPERJWFxUajNLam1dTyFMZTA6PTJMPlcqQCYrI204OyknNG9UbjIjRTAoP2RsanIodWtFcSI6IVdqXiItPFM2KS1XS09uIlI8NSwmP1A6LiZFPVMtLDEkKEM8UGB0U2pnJ0UyPGxJSlFWXS4zOTNoIVJlZTJUaklAMWJXYyJOJ1o8bzk8UC9SLlxtdVs8XUohJEREJjk8NFQmZVw0bEtGJiNgJEBZTmhtMTZrLltdWUEuK2FxJy9PV1BVJFA7SGEhVzBjTyc9OGlWUytScSJRYTZhaCU9PkY6ZXRqMytYRDQ/L0xaJSs1dDNIcV86RDJpJ2tkT10pMzwqcVpDRypNQUZOaSFpUlVkaG9OQURgI1Y7MlU5KEFEbmgtI1xlX25cPFJuTHRzTz5kX3NTMjM/JWEuO1BOYyEyPUoyIVNnUC9LakNBZT1wYiYsMTkpN1o2aHVhTnImLDw6bGc/cUJAODE0YD5qO1NVMGAvKDpUMEoyVydSSltCZVN1QVh1PGBtWTlqXXBlM1ErQmM2a05lTSpRLTZDTGRaRmopPzQvVSIpNUAqNUdxN086YiMkaWR1QURbLUJUNTY0aS9JMyFLN1VzIztcJ0VeRiJiamw2SSVJIlVFIkw1Il07b0M0RChoYUI4KFFpczw1V0hfXDM9WTczTlcnYko4R1JZQ3U9NUxJME90K2VVNWcsJ11OPTw/Mi50YVQzWClUTy0kQyYyPEZmMXBBUFolalwxSiVCS2Y6YFwvQzBLR2lwXTVYUkYnUFddK11Ub3FucVVhNC1wLVtPa14vO2pMLUZWNyVqZEFkWkBwZEpOPmVUNSxrbGRSJVReS2FUQmpdYGBaNCI/YVZRIkkmTmUvbzAxbypYXlk1Pz1FWWFBJDUxYyY5QSE9K0FLQC9qRyY7KiJZcT8pUjJRTVAyWFtgJFYjQ3RtIm5UIWlvUT0iJ0JITUM6QTpJZDBzWTRLLzdUKllITCFFV0AvVCY6dTZdcThpSipbalo9K1BJMjVaT2Mmb2sjbVpQUWc/OHVNVSUoK2EwWSlwUWZeI3VyQkQ7VzNeVjtYTVlfOCVTVGlWXThwIypuNVknW1taNkQmTUlNcmFETiFKdUpMI08qT3VITG1TZV02VXBVO1BKTU9WJW80cCJPVC5MWDpkMSlLMF9tVFxxXjxYUTwxPG5XZGs6NDtTUG9GWnEpP2A/UkghL3BkSTVTUyVML21XQURaTEtTVW1OVCNhN05DN3JoUiVpRG5HbVpTYF9wOVUrOFxOc1xocV8xOTVJRz1NISUuTTBPJColVVtwUlBwOHEwI3UtVGcpNkJKLT8qUlorY10kaV8uMCpvZ2g7I2whJDYxX0g6bnNpZilTV1IvNTQkODUtKjM5O25rXV4nIUw4Y2BVX2tgWl45SicsKnBoL0ttNDM5NTZFO0czdSxDKVdRMlRZQms9aS50am0+QEJYKkdTbSJrO2IlNlIpbklpTWlCR2NJVmwsI1wwPF5oNyIoRjVYME9bLzsnb1FeMF4hXlQ1SlBQXSxHTk5oXSJUQD1hTCRcODtjYlwxOigrODFKOFJlPUEmR0pUaEY0TmVcWjhbS18lT1ljdDFiK0wka1hmMjhNM2IlcW0mRyIvSCw7RjNTLEltWmhlNGAoMGQ+KWpvKyQzYCttIys+UWdoJ29WYyooLD1eKyI+Kj5jWWVQQ21UMlBrW0RpWE5QMEEhPkFLaVlNNmshIjJAbVVHcS9TTUZXdHMqck49Y2cpZW5qPERQIkVsMkhBTDZ1UUI0c1lpIzZLckgqbCllIy1QdDglSTVfOTpjWTIrRSUsMFAsXlAsQ0shSUpncVJaJl06VVFsOmRhWzEybldcKmQtTlE1ZWlWZS8kZVs7LTZgcj9sMGRQKU5fST1cOzlxSVU1XVRFZWovMTU6ZEksYSxzXD1ANlhMSFwvdURBUnE6dCI6VkklQUVgKkdPWWJUQmE/TTAwWDhiayU3Qy8zbWguZlhWMm4xT2RVPWE2PVstLk4tNFhjVldOQnFPT2BYOjM2ViNrVW5tUClJMWpeJzlfWzNhW0pNUWQkITsxPXBDQCtfbXAqO2RcdUN0OG8rZDU5ZFNEa0lKOSdvb001MG5kZ1NrM1ZdITdiITlKRHIyKnU+YXBiPFFSWFdGZ15lQWNnYWswLEttQGx0JFxqblpWakhRT2hKQXBKIyFeK2teNC1KK1hrLiwlPScnOyswJThbWDRLSUI8OUpdRSxcM0JMPDMlZidXbyYobm1xND9VNVxVImNJT0AqdV5nOlVpcUhoR008bDsza0JvQSpSNkxBJChWZWwyUyNYOGA7JGBvXzd+PmVuZHN0cmVhbQplbmRvYmoKMTUgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjc0Ngo+PgpzdHJlYW0KR2F0bTw5b24kdScjIjBEJ0YiYzkiPCZvLSxaMlo0P0opLzhhRE0xZllqZUpYW2AlbSRDcUA1PVpAYCZGcWw2LjhMcEcobEA7VTckWFFGVlFdTjs7OlFyJmFWTT5wYmY2dU8uMSs3Qmg3O0w2dG9QIi5NcXIna1RIP0BALFdTZVRTcCsycSk8Kl8jbENJbDtFSWgmUTM2UDBsT2BYZVRdMkE8YzFRUz8rV1lWNTswLj4uOm86cFRkXEtrZUY+VHMmS1UtV0pwS0w5bi9zb083X29UZ1xEWVVRdTYrRTs3OTR1ZypFLjlmcmhnUipOLS8sU19LLTxQc2pKck8iMjotP2gqbUprV1kjaUEvYz5AaltiPF1CaUlwMFJSWlAlRnNmb0JbIyFxPig2MkEnRFsrbVtkWkJgTDxkJkBQW007TWgnLCFDLVMmJVs6ZF41PTFZL0ckR2IqKVpSOSVUVFNlV1IhSSM+KWQsJl1KUUE+L2NzbiVHJFRKLlZvJnREY0VeSSIsWDFUPFhMbyphVkxsKUkoZUMjVE43Rk1sMCpZSTxrPSo5U05fJE5scnMoaz5nZ0lQVVZBLiczXUVTa1JqOzxjX2FaVUpJOG1BKCJkM2hIZi1qa0hNWjNGbEhkW1k/VWV1SWJYOD03ak51VVxsI3VnWCo3OloiczQzKE0rMydlUStLPlUwI0QjLFhES2NVJCg7Oj48OW82JUVBYF1DKycwKCE/OSMhM3NALV8pLTgrTmQwUCg5Ky0mbVN0VytcUzAhQllIX1QuLS4yUG40JF86M1w8MDcrXismV2lxdHBGckciLkFzIj5LQkhKciMvLTxCPU4/JW1VWUI4ZnM0bCRMQj5iRXNQU2MjdUBsJlJHSjhScFppbUFNQj1BajNAS1klNyJzRFdBSEM3MjgnSy51JztwW0c1JVtrUSlNJnVtVFxlbW4wRUhpZ150NVY0NS1sI0AiRGRUVDxDVCxDY1hQcTxgc0xET2lMNCo0LmtwLyw0aT9uZTI9YUUzRU9IPlMoYkQmZCJLXTpVSGpCVT9bNihXVDhnXz5bMmJmczUtXWp1aio0VFQrKkNOW2JsJkhCb0diaVoySzY7P0VTIS8kcjNMYignUi0haiFmXjo1IzkqTiVPJnJiUihfVk9aLFlTXixPWlBHWGFPQTknaz5UbFdEJyhHKE9ySl5dbVojJytUKFoiaT5cPWxqaCdbITNmNGxFdVFONV1bMiU/YlFiQ3U9Qy1DOmglNz07NmY3R2tNJChGYTUqOCRBbkc/LyF0OjYxa0hATz4kJjtfTFhVK2g6b0BPaXJnKj1qOyRNY1FmZ3AnLWAoMkQ0Skk6QiFTWmtYNGRNVjJcNnFLYCwrQUE7OjRaRllpKnJONWpGXTQ6RzVjY01YYEhrVmcxW14kSVFKT2AtamknK2VrYSZkXnMva0lZclU7JXVHRkUpVUlSKzNeIjM/QyktYWZtQSJucCtlViRAQkprXzNKNWsjLmhaUjJPM2tGW19gNVA8ZkdGZ21ATE9yOFUrWTItWEUjTmlKY10nV05GOVVyJWE8WW1eK1Mib3M7IWlAak1ccjlYMWIzITQkSWNURExKSExwTDJtNnE5RiwuMTFFQWtCRD00ZFM/J1w0IihbbGN0LXJvSTVEJyguOicmZCg2TmxhZDZyOlMqX2s1XlAlKiRqQjhiQEhCNnI9UiRWY1JZYEdrPWhCdWtwQ1lXVytkUVMtKCZXR0FnJjpAa0BGWkVMIlNgSSlIQC81TDwhaltURz8nLTdpXzskLmRRIyVSQyMjLlU+Oj5COzBjaUROOW1wMW8mNE9iJytlRUByWDdfND1IMSNEKyFYWmRUTFVPK2JNZlNScyEocyJdZzpnOEtYcThNT25scmFSTVBjUDoiYC5HUWEuRTVFVCthNSIrT1ouQ0MwQzgrRENwTiZERmhaWFlVMjY8MFRoKyVdO0BIVU8tIzYtRjBYWVlrVzpuTWdTPCd0MkpEIWZqK2gxSFYwOkNRJV80ZThDUGglQlkmPCc9RWFmZCgnVyJnIig+JFwkXEw1OGwyNjAkIkdALT1pPSYsJ2hnLmwmKG5Ga15dNChlIiJxXz48bHMxZnNWaV9RWUp0SldAMSdTTnBVLDo5VlphZT5XWlNzNFUkUCs/PicvQ25XXT5MPkwsRTBpT0A2RzhXVSZVRSlPNVlEZlduUmpoSTI9KTtTTW4ldC5pQFc6SzUvYGwuLkdzK1w/b1o+LXQxXl1xIy82UUBWI1c/cFBfSDs/XGcpPGZgJCkjO3NTOzhzM2ZmO25SJ1RhOzdfdXJJYiRLXEtbMVlwLlcmWEVtcSRcdCZUUz4jcHJjcSpuVCY5Ri06aGA9ZFJkNiI0KUdIZVJELUw3LSlPaUg5bj0vdUUkLl5aNyNIOCpcMzQjPmh1WEg1IWRIMUNZRjN1R1tQME9vdWVXbTVURiw5KnAvXmA4LWNqWGczN11oc0lGOyhDdVJoa0FtVWBtXFNucmVgQz9RcEI5bmItKSVLKC1EXzBBdTZRcmljZmVkXWFIaDAvbVJPWmlOJ0Mhay5rRFFlOnFUWktRWVtTOTBKckFGNCJBTmEla1lAaEQrRFkpIitUJywiXSg/JnVxaU8rPkNablJRR2RdMVNtMUw5UW5mKFtaZFs/QidjKTJDPDZHVyU7LyEwcD0xMzxqbSw3WD9XbDUiMVFgJF4tYS4kTUkncl50QEhEaGdlIl1AaFhyK0ZoOlhPcW9QZi1LSFxzUEl0OlxyXUVkTFY4X1kwbGNhOU8xdVg/Pm09O2ZKY3FARUlUOmVFTzZoYFxdOkddMzp0KWIrPUAmX2YzJypqPVtjI2lfSGZWYVZmIj8hZ2FWMycuY05NKCItdScjcGZKZHA7PkIrMTNVLUpaTE0/PEJvXjlCPm0wRFsuZzEnRE0sdXQ1KkIpYiJkT2ZWbjhrVlFATThMaCRRZlI9VypKVUAyMEcqMEhNIUguNyI/X2NsU11ddElLRyFTbVxkNVg4TEMjSmc6P2cxJmNALzEpOXBDbEExU11KODhDN0MxIT49Z3JxUDk3cF5AJ29aZmAuIUhqTTw8a1E2RWtANlApTm8uI1tUb0s0VGNDUT5vbjcxJl0xYGpXI0pfNzxIbFFDNE8lcWMpRS1iRzlkaGlzY2E3IjNddTpJUkl1Ym5wTVxKNmJPLk1LI1EqXC0hKjAyWE9bb1txcC1SSSdzPm1IT2BvS1hMPCFWPV9RVjpLPFVeIXFKSmolViYhXTo0MyNYQjw4cmVWZiRFN2JNQztBWk9SJXBxcGQ6W09JLz5JSF0rJmZeVztDMipVcUJFZyJgbjpXXjw+I28yYSFbbHFZc084QT4uMWFEYW4nJFBaLyUiVjdrQkEqKCItJkJAZVxEWjhwUzFqNSE1PWJaXVpbRUA7MFVOXCdwSWtXZik4PzpFOFpYVSQ0PVc7KDomLzgnTlJSUEcqI0BQUileXj1zSEcpRVcwV28wLl5nMl1WQTwtbjw+ZlpYO1VPSmEtcnBcTFtdPzJvOm4lRGZrSFQoRC8nZnNIJ2NyPj5MKEgrOXNTOV0scm9QZyIoYjxbS2pMbDVNa3BuL11qX2VyZGEoUj00PzczSFh1VTtjczRDNCtQVGJuInUkJ1gmZz0/TXRDTGcva3V+PmVuZHN0cmVhbQplbmRvYmoKMTYgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjc3Nwo+PgpzdHJlYW0KR2F0bTw5cD0+QSZcXCdDVF85IVksciw9YEE9cUd1bVYscmFNPEYoMTciUVYrODNkUTdVWGBDb0hzUW9KLGdwMWA7XGJAL1VsZTJpVVxqXzIlbnApYVQ+Xl0ySEgmLTJaQERlQFlVIWVAJTg2Nz9COTBnND9RUywmbktyWGlNW0syWSoyVlZwLW5rKy9iRWY/bzhHPUFRNWFtczhbYllMR2JHLiRHW1RLQT1YJiNrYz5Lbz9nPiZxWF5LRD1GWmZzL2xPI2tyISpROUc1bSpyZXVUcmUyVnBlXU0wXlEiZUNMRT4iUTZFZl0iKE1UTCEqYThjZzguLENfJl4xMzQ6UTUjU1xEcUlOT3E3RCdubWAtPSNsSVYnTjlkQFRGKThXQHNGNktGImZ1XzwtV2FrLFxFMFVfZ1kxU0MsTU9qUlkuXWluOD1KOVBUQEBUM01XaVheLWwlW2tsWVI0JCxEPmxHdDdYKENlJFxMTjFBWitBJzAia3FialAwJ25oUUpvWCgxdHBORz1ecFM+IyNJLlJGNjdeZVZIc19GJmUoZEpNYD1IWzFyN2llYUFUYWRJZ1VFPGNLWE1nMEMjYjI8bHJUXTg8Oi5oU25hMSJpX1J0TW9sQUNePHJnJSFJQTFaZ1BHZWpEMiJPV0Q2X1FNUyJqQF1UbkdfK2ZZOSwrOUBgJy5mSU41Y2RRUTBcWXBgc3EzRDh0Pi1zYm1UMz8kIiQ8M1ZZLigsXEU7WVJAVEZCQlxqaFEjLlM2MCNbRlYmc2F0TEBGbkVtVzBLa2psOnFgaUMsPz0zM2spV00yNllVcz46NiRHPF5QVlcsRzI0RlUvbEhVVkc8bmM+IUBhVUw7Zk0rPU45bT9kJ3VebkxcTjo+R0hwVyxwWWtuJ0k6c29iNl02XG8uPkxbajA7N2xmVzsmPVg3W1JicDVlXzkzSEQwW0dxUUMucl88Q21sOzVpRUFNLlppUzw0a0c4R3VWLTBVZiE8O0FgaWxBb2dJNy8nLkFjK0c/RiZPQ3JERF5NTUZpaDdQSj8iRi9kKE1uIUdBKkVfQEBeUnQzKFxDRyJiaXEldU4zMyVHKFZOIzU7bmVTQmM9Sy83QFciSFo6V2tNU1NFa2dFaEZGcEZCOiluY2Jlbz81aW5fSkFNaGFvTiY/MC5DK2JPM00uY10vJi1dNScyZCgyWSZRNTBnOTpYRHVnbWU6cmotWkhHWXNiYnBYQC1cYEhOX00nU207SSpjMmU3K0pqNzZsaU5DLE8sRjRAXVFtUi5dYilhYD1RamxJQ0EkZypNNi5UPi9uIkxsRy5hZD0pU1dIPiwmWmEtNEZyYWJjKGxjTT9dZmsjbDQ0MUlrQzVsYGRVPSxkKFQ1VEZGa0h1MEwrYjU5MmlPTGcsb2dbS150ZVFoPWRxUihgQ3RvXSVtYFhOIUAxWSlHazlWT3BLaFJZRSk0T1E/T1BkYEJjNnBZQi9yYT1cYmFQanM1MDFaX1AnNmpVUWIrLEU7L0VUOSs5YG8/JExGIy1IUUBpIW9TSD5vUi1GMCNzMidmQXJmM0hxQEIsQjVqO0xuOTtJKU1wcksuJyEiTF5dJSQlTEZBLz0ubSxfVCsxcis/cUU8blU9QSJYLCM9Ik5lbiRQWkNkSE8qMDJbNSFTW2FRXDA6YWRaWTlUbGZIbmUvOl1HVGNqIUpaUDtUXS1eclQkQlFVNj86RGdBPDVxdEdrKztiMWJsR0pRVCtIckpbSDgtZjNZIjBuNVxvTVhgX1suVk02ZGwvM2hpIixNYW9WM1ZnRTNlWThKMkpgSF9tMGxsPmZTQDMla087TGNYYzwrVE5JdXM0UCR0b0VqITRlOzomOmMxITw8RSY6PHNgI2tiJWsrMiEvSTJIOD8zJzUzYTQobm5TUypwKlpUX1FrT2MwTXA7Y3UtTytUV0ZZQUA6KCsuQ2siWVBzIXVBSyxTNishIy4lLU0pXysuXSpSSW1TJ0MmJVolUkxfbnBJJVckQFc/MV5mNj1TXTphTm5kaSwnQlosPl1samRBYzJzVEQqJTMnUSFGZmA1dHEzIUpSSidSalZYOENcJUInbjRKJDZyYUJhcV1DOCkwRSszOTBvT09AWjkuOT5eL29YbDtBSzdATEZnPz5JZltmOVZmVEpGJ0FLJGJBN0ZgbURsL1Vtako4VjtwZG5Ncz9PVVkpN05MTklsamJyWl9rJzo4S1NoVU9ILiVcayVqJExoRUdPKWcqZmFMMjAzQjJgL0dUWFRQMFFySy4jS1F0Jz9VLVxVLEkpMz5YJE0iLShxUmdsSW1HOmcicF4iLStGN0YnPV1sNmckYGFwSEgzcEtbWicia2VyWjssTlJKdSlHXFZRJyNVIXVXbCcvQUIrRzQ1IS9jUiRoQypLRHVNRFgoZE9MN3VpI0lRaEIsJFlQRTU7NSlkPCFEbWMhQis2Ljxrb11bY1U2bG9DK2I7IjJcSlsoO1pCPFsqQWpcaU5dUFMucV8kYjFhMCc8UVAlJTEwSjAqcFcrIShHaiMhMVNXLElSJDBJRDEmNllaYDkqb1VEKHJwcmI2KCRQQWFQc1ZcIj02UzR0OD5JO1gmaSs9ZzlwP29ZS15pVHNpPV5HX2clWjNCKVtUTGVvYWRuS0lnR3JzUyQmNHNcKkslSyQ+ZnImLjdJOl00Y1xQLFdVKkklYFNuWjlQVlRLJFZMISJUMiEtbFMqQmpENiEqIz1FU1g8UlpxLEksZ11WaTk2aFpeRWlLT2omaTxNWlM+PTtlLDpgVGc/TEEyK0ZpdGJySkE7QlQtPVNTSjc9dU9gVyNpU2k5LEE0YUZJQ05WLFAvPGs9L0VfUF1oI2dZS1tZcitrcSJtY2YmbisldDdbO1w4bzpIOTJVb2o3XiU4bU51JUI6ODRzR0doQy5la15YM3UhUzBBRjNlRVk2M29vNDQ7OFxjIlc2P0ZBcFdcLGJoPipJcSxSTSNyIywnb0RnIixeMGFmI203KyE1Pjs5bT9vZGw9aVhXcnFyVVNDIlBvN1VBK3VeNSw1KURUWEpwVS5WWkBCUlw9RlZCNCNZRE4rb1ZUbmdiVW8iJ2ooSnRpSiNHWW0rRmM1Yzs2QGNKQVE0MG1GUW9QLGwuMFY+c3FvPG0nXy1aLTRkUzxxVz5TTUdKZD5lRlNGaDVWXztzcTZIbTQ1PDBzb3EjNl04K1ZOJnFPYkJddDNHNXVETTpCWidxa0N0LDo6JllmbVVFaUNHR3RpczloTG9lNEBCQlpgX2pzRHVAb2NmYyJtWTQoPiMzSHFER2JERjQsYyYkRlMya1FsampLVFY4akJUXF1bLTRKWmdUJlNDbyhbXSEpPF1CPkltcT5DNCcxNjFbIy4/RC1iKUZPTEw7ZUxbQ3QnUkFnX1Q3Z14hI0ZDLGo0QEVJMF4saCFESUtNPW5ZRykrR2VWSDFdSTBJSGA6JEElaigiMVVDUj90VnNbXTpLMiNeMCxJWGhJMSUmSTFLLC5BS3FJIWRAaVtES2omLV5uI1M4MzhIYWFIUE8uN0VFNEEpTlxNVHAiJExyI0xCR2NqbCRKSVFERz5sT1hCTitDalVXMUFZc0k8L3JcO29uXktfK0FcWSJvWmRoQWVlSEtcUlUwTj5FNkdaPTR0aS4xWj1ISiVEJFtXZGUkWHJNSERPUmAiZmUvZWFpQmJpYlpRRyopSVVza2dtfj5lbmRzdHJlYW0KZW5kb2JqCjE3IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI2ODYKPj4Kc3RyZWFtCkdhdFU0PychYVsnbixoW1wtUTlWLjN0MyQmay1aMD5VTXJMQTprUnImRzBzMU5sNmNHJVBvbkc8Q1ZGYmNDSCspOyZgIlNsPFJMKS5HaUJsY0ZwT2pgVjwlJnMoK2pxcERzNSoqc2o1Qm0xLEFeVSkhKDBWL0xOcUlYWCowLkFGNWInaEBNNS5wRCcwXCJXXCNGNiR0c2Q2WDVfOzc3by9iI1ZCMFg+ZEIzZGJFcWdcJGApRz1YY1ovJGlKMURXaEZubSxRNVs1PTElal1HKDNwYnMkQDlcW0NoPSQ0QUJPUkIyUUNmW3RtMiNRc0I0UCVbJl0pcWVhRCclXF5yQmB1Tz9HbER1Zzs8aHFkU0MkOkxsIkZsWixfZl9aYShAUnUjI2VxNkZdVCYoSSY8bHA4MWcvLF9na0lQOygrIjc/aC8kZUxVOjdhPFAqJ3AkKipzK0VbKmssVDIubzxpN0hwJylTaypyS1dZWWY6JjNWSThTWWVsIzdzcnIiQkBTIm86aGNfRWczZWFIMFMyZUVXY2FBTDtfZyopOTs5Wlw/SCdKTElGKl5UUFdXKF1Ybkc0ZkFSIi05KUFOaU9WLjxaTSJeSlI8Um9Ua1gocFMhKUZbTmMyIlNzZjIxQHQ3SzJmZWBjKzwjQiFaPEQ1Iy0uNm9sIzpKVkpjQ2c8OjphSSc3PDRyT3FTRkZAZjx0Wj1xPDleOXJRWWNcV2c2P08sMmY0SDMmWnA4XHBQaUMyXjgycyltb21Pam84UyhSVzFIWFNoaXRfJG1GYlIvXUNpaiRLaD1JY21lZiZHMXFBMixzLDxPK2hkaWUpPTgqXzxNLDhTLi51QyEiVyFiSl9QOG9PLzsmKjAibSpQTFwzKHBhQSImYDxeQy1WTSZeKm9vN0FCOFdYYD5yb1xGY0todDxgI1dvMUNEMic0cGMtblU+bSxHS1ZNXU4kNFk/YVNaK1JFNzxUJXFQKWJPWU1oWiRzKVJTOkxaVU0sKUo4OlVTNGApYjtKYEpoSzFfTi40TyU/PThPOEhaRlg8LGVHOFtrPW1FIlteR2xdSWosU3REKkdZUFM/P1cpKDRpXzxAMzUzKSd0NThYUEQvQjZyMDA3XDQ6S0VXRltoRj4kVlRsImJlYlpwWWxEV19wOUMoRWk2MWI7PipjOE5PSEVOJ1U2YGReMylyVjw5XDhma1UhXWNbbF1TQk5bXDE9OXQ0Y0VfQyk5ajhPQ0JaU2FkPWdmPFpLQzFPTk1qJ0syTllLSm10aVp1XnFkK1FpXGxQMnFrY19sZUhsSmtXaD5nUzhPM2NUZzovXEpMa2tbP0Y6XzlmTDs2ZyY4UmJgPkQ/KiVIRnVqRFhbMFhJRCRFLjooOCk4JltDWkQuJm43SWlzOWkoa0JPUF5xJ0RiWWNeOi9vTCRabkAkTmV1YkkvRVBdTlxZKShCaTUjOC1sRl1ANlFrQFcqI1UsWGEzJSYtU3JmRC4kKGpsQ19LZDBxXjwiI04kW140TmFvNEVFLC1qckEsZ2hdS3Qrb1chI2lmPz5cdWguZ2hdNmFqOjM/IzQ0WSxBQzE5bnFxQ2FFV2M6XSZnW2JxWEVFPFoxRGdBay5qZDxkWzYkQ2ooMzYzPDhpZiljJFREZ1gsW1E1NVI4NkU5SiMlLVRcbVIkVyEmZmg9LmNwKmNYR0RKI1tjKHArT0pXS3FwNyVpLEsxMUwoLGYxMFckdUVLZ0psJSZaYkUoUG9gKm4rLDs7L3ErOGUlVEItIyNJRzdkWj5FdStRc1lxbDwmblA9X2VlUDQpWz9GTy5ZZWRlRjZHYzRDRDJsLTtsaSomT1ZrQEhFPGhDUjxDWFpAIkRnXkElYV4+IzQzLT8rNjZNVSFVSmVgWVF0cUVMSyE8S0FQKm1sRys2clhpYUBtTjZmay5vbWEjc0RTPGFrXStMKGEsdC4sPkh1QCtETyUmPStfVzIlc3NwWWpXTUc3Y15wJEU1a2A4KUAyKUNHJ0NgUFtPKGFmM0MiLGNwNCxUPmdeZ0VhbjgoTV1WQCU9WmkyLSVBQF4/SjZnWyEuIitHWTNVa1w0TDFJcmgoRD9lVGpsTSc0W29sQEtGLzNPR0ZZZ2YvRCUxTFlVJENONlw/Kz9RXzdBPk1VbTRDV1NLai8lbF5KVnEpTz4xVUNxM1VXPCYnW3RLQW9FP0lpQWdzRVtkK09ObGU+XFYpKFxUPEQ2JTZwP2AlYyMlI0ktKW44PHFkYy88ZlduRlJGOzZYKS9oPT9kXW1Pam9wM1NIb281K2AwIktCWS1VOUs3bnEpTT0uQWdLRzlGPU1oY1lWLCtsNCFwNnBaVmYuailSRy5Qakw7WCwrS1UtJSNmOGxCQ2A5V08xX3RlJ1VyJkBUOGVvM1oyS2AmLzgnQG05KUAxWGNEcnRdaDNnWTgxQzFOckNwN1ZCLmNHLig3NzInSS9yZTVnM2hzTiRAJCtOP0FlRGpZTCo2VF9yJiNNTV5fczMlJ1dVJ0BjXzFpakpmNicpWmZWOWBJYSxVX3A2cGRZT0RxOj1zQW8nRkJlbWclYi1CVCpYVnNSX1ZlW0tDNDUpRTRUYVxwIzNsazM3YlBnW1AsQFEjO0dzPTxxSyNpVy1uQDFaUUJDRS5FUEtobkcqXVtyZDF1QDQpcDdHWU1kSFV0b0teLlMpPEdKb0dcY3A6KU0+NjNkMCFlODNCKCZjXCRyLm5BM1tSLi83QFZHY0g1PlhZazJRNV5bOlxscEZuU0w1NlFjWShDJXQvMHM1TUxpNW1iRj5dTzRbR1NMXS5vMl1MLFonc25DKThLLS9xPTg+LSInMUE9aXJPNFMlWywtbytidV42XixXLjJHYTNgN0hkVShsKmhORjdjYUxIVi0tdCVzOy42M08+SHQkPDI/cCZbNUdlWUpCYl1DbGg9JisuP0xFTy8hdGVVRzNEajU1cildakVCcHNiSGc8X048LCRKLWQsPUhQUUIsLmVYRk9PUFdCZlhWVlc7SUJtOjU9T0dxVTUlNTJiLF4uPjEybXUxNixfLSVsImdwSDZkb3RtcHBjbGpTQWdOQFgxQCtlbj0+VEJJYkoucCRHb0M3cWReLCoiRWFkN3Mlcl9UO1BtbSdHLV9vM2s2bUhAXG1KXyk6dDFoWXRnJWo2YlReczJVL1BVPURSW0IlVGllR04tKS5Qajglbi5HP1hAPGRiVVBSWk8kLmE5QD1GSkBAck1CNCRVKGhbUXExSGJHdVosazVwUFtfJ0twLGQjUEtOZltsaiRxVGNmVV5xNl1saFw+Kz1vLmgvKiZGTlNucVBCYUNGSV5fRjE/Kz9GUDdJSkBGMkw0YidtWDFqMkAmVGglOkQ7UitmIkhcOEtNQkRuOilRMWYiXWhsMiNfbERaLEEhLkF0MzZOXGRHNFluOEpvN3AnMyZILWAkXm9rUHNNcFowLylyMzRTPj5KOWE+RSx1PU5hcVpcdFxYW2hiREZTZ0FbTGw6cGFDZTFiIWtgc0xGJSVOb0FKWnVZaGdiU1giYCQhJj07IV8zbEQ9SHNAXlxmYC0/dUxyZkYkRV1oaFlbXkZdS1w0fj5lbmRzdHJlYW0KZW5kb2JqCjE4IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI2NzUKPj4Kc3RyZWFtCkdhdG08PyQiYVkoNEZONF5kQmwiRyU8NT8scGM/JGcuWDo5XCkjY2VMUTVeYSZzQklCIT5aZlsuXk0/Z2NOUVI7QTxPTzFoKUpvZFU1OFxobV5fTDlANTMzRHBVYi9YcXQ/J0tvM0s0clBoa18wUCIuT0VxblRxXEhoUj9DRStLW3RtU1klJGlEUG8scHBYa1k9KigkXVAkZkVXYXNeSjQxNyUkIVMub2IvZF4jcENVTWMtXWgyIzZUYHI2KTtpZmUzMlhZZG9uPWhKOWhzKDZLVCs/VFVUJ0I8ZmctSGFJZkFhPGtJLS8zR0poZjFNcz02RmE6PFs8ZWBrMk04TnFaWFpeQCg8U2dubW9aKzpAKmlLWzFvVlJDYVUsTSplXCwnOzZcMUtoSjtfQkFPXVkxRDIjITgwPUEqRV9hdSdrblxBL05cPmtyckhZbHFgOCpqOHVoIWVZLkEpPGBYWnN0KDE9YywsLDlxKDdqa2BLKVhmKXRHWUFTKEtrYz1kRlFfSDw+S1BjV2UxYktXUSlfZFtiQUBvPT43Ol47RlxFMkk4WSNGP0tiaTxRczROQjslVkBQb3MxN3FpX2RuXy4sNytFMTAsWE9ka2Y1OS0uS0VlUWErKFwjR1tpNmlGdGlWXTptNUtXb0dHIjIoTGBGKTcpcFZPXVYjcmguO2BAN0s9UlsqRDlLZTBQVS5cQSs3MF9Oc09gcDdeY1FkNGs6LHRxOS5ZLCNvM2JHLkhgOmU8MSkpVlVgVFg9cF47WF5HPD1yLi5YKU5ZJVZbLkAuWF0wKWJGRWhkakBaXTlEL2YoMHFPUmBWRmlHRCMrNEg2RmtkJlVBaTVcLGRWNFckMDwlRWAsJGVOUzZ0ZGozVCNbTiVyYjUyYWNuVlVxdUowazhLWWJiZUtfSzEtVnNOM1FtR0BtKFZaOVhyJz9mLkt1RyF1V1IlWSVaTSE+UDhGXV1cMWVxI2BOc3NtKUdIVFRfI1lVXWM0OiRYNTJpQ2RyMzhMX05CMjRPaTRkWDxiRFtJPCNRMG9sP2chWE9QI04wQm0vVCthc1ttL2JUbiRuJ2FYZmIpWzJxPmRmSzYiXU9kOFRTPCsmJ2JOLyFVK2EuX0oiK1lTTFZnM0YjRGBeakdwTEBaQjxLNUBkUXAnKnApWDIjPCpzcT51KEIqL0pHJF0jOCtIaUwjM0UqPmdePGBOKGwtSio4cTE+ZE0oRW9qRS1yanVfR2tWdTkuRjpOalJIZDkyXlBBSzJpV2dPTk0oY2tZaV1dMTZobCpXaEtxYm1KP2dVQjsjZzFqWzFdVExcR2hkQjlGQlkhRTc8SWllZmlGUjRgcSQnNzosaklTbD5SIS9QTU9dbUFtWXJkUlE8SzA9ZiVCZmlEZyo7Xy5kLWhwMEhMaDovPDNkVTpHSyQoc0JQLWx0Tm9HRmwnSFdSVHI6SFMjKXFwLCtjZiJtKWNuc3FkJjkvNSlxTkRKSlY8JihUZjRGa2gibyo2ME1RQ0xLbV49M1BKLXU0WC1xU3U5a0tuPXFbLS1APUQyPWAnOi4nWUBAbkowKlQja2NjT2JdVktAQj8/bUlJZTcnMGVgTUkobThSJ0QzS0wpMnVPdV1vcTJLbCVSO2U8IjBxcUk6bjtPZFZpU0VHXDpqJVFYUD9jcF1nayRYblVmLyUuISVXXmsyNWJTPiZTKFpiYFwvWkFYVU1BJWc/SlU8TiYzOGdiR0VGMyprI2lVdDpUayw4Kz0mYlUoViUocDhMM0thS046JCglO1RvX2EqLGBwNTApNFNdTUAwTyY3SFMmcCJrL15YQTRUKk9cNV0pOjBwa2FTQVZFLSxUbTNSPUJBUSJNRT1KPVElXm5KJDMyOixxMVxJLltRV2xEQV91WEc5VzUjcCldcDNtOypNKXUxclBTZThLNFNkJWlSVmJbWENXbGBrO0BmbShePlgxTHM5QUNNN2kwVj5yb3VJa3BVS2RHbVpwPCE/WHM9ayUjXChGSFIqViRrRDMxQV1CcighRjRROWg+VlZYRmRlLCRkRipzIlJWV0BkIWtvS048ZihbXVNEOGUqZUQxaWlfU0UpSXBhLyVmX1NWTyY9cWdgMy5uUGlUZW9QRlY+Nz9sOltFPDhEaVxLPVU5Qmw5TCQ9OGdlYDQjWS50VmQmZFNcSSZAJlIoLXU4S2ojRDYtcDRmRGA+Izw3YmI0S3QkIlIpPEYoODlack9DZDlOOWkpaWwnQzwuVHA6TyksZFxoZlgxYjZfcSpvS0NRPm9dNyRIITgsclIqVXNyKjY0IUA6a3FuQlojZD9sR15tQ0NwYz0xXj5zL2hBO1k6WFg8bGlDZ1dxajRXSSJxVSxeUTtURjhcKSFILyFYMiQ/Z0xJPFMuakgnZUJYZ2YucGlVZC1LWmx0XUdYXlVRdGB0XEYnckZSOlpzPGI9Jk5VWG9AOzlYVSRHalYqVGl1M11YMCg/VipjLkhfckM+Ri4ydUdGQShzRiJBbkAsMVRsbUNASzBmPEpTPUI3UzJcUkZgWyhHXmYzWFpnWWcoOS5FblowPFBxPixdYm1rS2JLNTVYJ2lGR2pxcyJmbkBcJj44ZDlfPS5CZyM4IllTRnREOmxxTGlual5gMW5xbWs4Jz4+SnVTP0gxPkw7UHJZPCVZSGpDQGFoUEEuOFZxVDNdLmppS2BWUlJLSU1kNzNTYDlMYls/SXJpU05LR2hMRSNoZCdAYE9ScmBDM09ALi0/RSdkaVtcSitGb25sZE9tLmUzIk8iXVchIUNJInJCOVI+cCo3L01BKWs0USwzL0clVmNzQDg7NF1vQmFeQzVqI1MnJWRzcXQ8TigsaT0/ZmJdM1sxSDFOVS9dVUZ1P3VDO1dSaT0/YmdaTXJuZiFqLT1VbyRXZ15hYTdSJGYicl1vLmBkRmZsZjhXKW0nQmpnPCFsJUs+VStJMThicWArRT1PW3A5Smp1ciolbkc3OEVpUj0nKztGYVstI2osT20iXGVKTCs2U00lVidWK0NiVlVXa04kIzhhVGxNRFg1XzxBYTBWYkc7Iy9xJFZGMitlT1hRPEhOZy5UbSFkTjpwKTY/T1NjNEwyKV1oWkVdTlVtcyYoI0s/QCo2RTNrJXIxcC5PIzoqZjVPXlRoMSpfWytlSWU4ZSEnREtjUUdzVEFXWGZEWmRbMVptY3FzRGwlZ1VOdHJNWjgrcmFlbCdrMmMrMVJDUDowYlIiQCRZQnQoITMlRCZKIzI1QWtMSlZdNUUsJUEtTmlGVWZ1cjt0MStaJiRCVEMtYl85SEA1UUNTbWQ+Kk5FXmxhLjc7ZWBfUDVPdCIxcyNEaWwkL1xYLGddMFxfSXJBamtybGxUVT8tOTc9RGciXyVzXmZUV1V1P1VVVkVMM1RcSS1tPChYLUNCIlFpMVEuJ1luMGw0YHJXOkBtKGoiY0A9YTM+JlUoOmBJWlBvakI+MDoyYzpAKT46PmBIZ3IyRENxRE9xPWMyLCdOLExtK2NYJi1AODpLSk4zOzYpdGttZjtDYStVS1VYMVhXP1Y/Kk5xZDoiNS88IjxxXyoiPkRiVX4+ZW5kc3RyZWFtCmVuZG9iagoxOSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyMzAKPj4Kc3RyZWFtCkdhcicjYjc5K1gmNFE+QGBFZjNyWXFISCM5bHBPSEBYaW85T1ciTjw+VCNjX2RhU0dEUCJtPk9TVER1akkuOzAiLEIsSiFTMm4qMGwrbilgUWpQNCk0SGk7Q2FvWiN0K3NObF5hbW45T2dcUVhwSldRPTI/OltVVU4rXV1ZMSpXaVVCY0pKTHA/R2k+ajhKXT0qazhgNUwvSURJbVArT2dlK2FLaEQ3VWpoS2c7ZGVrdSpqM107STQsWGQ6MnVfUF5NW1N1b1ttM3FbXyxEU14tKmdXblY/KWRBTEtxI1dXLTVgbH4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMjAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA1MzYgMDAwMDAgbiAKMDAwMDAwMDc0MSAwMDAwMCBuIAowMDAwMDAwODU2IDAwMDAwIG4gCjAwMDAwMDEwNjEgMDAwMDAgbiAKMDAwMDAwMTI2NiAwMDAwMCBuIAowMDAwMDAxNDcxIDAwMDAwIG4gCjAwMDAwMDE2NzcgMDAwMDAgbiAKMDAwMDAwMTc0NyAwMDAwMCBuIAowMDAwMDAyMDcyIDAwMDAwIG4gCjAwMDAwMDIxNjMgMDAwMDAgbiAKMDAwMDAwNDgwNiAwMDAwMCBuIAowMDAwMDA3NjQ0IDAwMDAwIG4gCjAwMDAwMTA1MTMgMDAwMDAgbiAKMDAwMDAxMzI5MSAwMDAwMCBuIAowMDAwMDE2MDU4IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDJiYTFjYTJkYjVjNjNjZDcxYTNiYjkzOWI3MDExM2IwPjwyYmExY2EyZGI1YzYzY2Q3MWEzYmI5MzliNzAxMTNiMD5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gMTIgMCBSCi9Sb290IDExIDAgUgovU2l6ZSAyMAo+PgpzdGFydHhyZWYKMTYzNzkKJSVFT0YK';

const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'];
const NICHES = [
  'Tech & gadgets',
  'Health & beauty',
  'Fashion & style',
  'Food & travel',
  'Business & money',
  'Entertainment & events',
  'Gaming',
  'Cars',
  'Real estate & home',
  'Education & careers',
  'Parenting & family',
  'Agriculture',
  'Sports',
  'Faith & motivation',
  'Other',
];

const WIZARD_STEPS = [
  { k: 'promo', q: 'What are you promoting?', t: 'text', ph: 'A phone shop, a skincare line, a gig…' },
  { k: 'niche', q: 'What kind of business is it?', t: 'one', o: NICHES },
  {
    k: 'goal',
    q: 'What do you want out of this campaign? Pick any.',
    t: 'many',
    o: [
      'More people knowing we exist',
      'Launch something new',
      'Sales or enquiries',
      'Fill an event',
      'More followers',
      'Fix a campaign that flopped',
    ],
  },
  {
    k: 'budget',
    q: 'What’s your budget?',
    t: 'one',
    o: ['$100 to $250', '$250 to $500', '$500 to $1,000', '$1,000+', 'Not sure yet'],
  },
  {
    k: 'start',
    q: 'When do you want to start?',
    t: 'one',
    o: ['This week', 'In two weeks', 'This month', 'Just exploring'],
  },
  { k: 'who', q: 'Who are we speaking to?', t: 'who' },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  db,
  onCreatorApplySuccess,
  onOpenPortal,
  onOpenSignIn,
}) => {
  // Creator form state
  const [jn, setJn] = useState('');
  const [jh, setJh] = useState('');
  const [jp, setJp] = useState('TikTok');
  const [jfo, setJfo] = useState('');
  const [jni, setJni] = useState('Tech & gadgets');
  const [jw, setJw] = useState('');
  const [jok, setJok] = useState(false);
  const [jm, setJm] = useState<{ text: string; err?: boolean } | null>(null);

  // Ready message drawer
  const [outMessage, setOutMessage] = useState<string | null>(null);

  // Brand Wizard state
  const [wizStep, setWizStep] = useState(0);
  const [wizData, setWizData] = useState<{
    promo?: string;
    niche?: string;
    goal: string[];
    budget?: string;
    start?: string;
    biz?: string;
    name?: string;
    phone?: string;
    notes?: string;
    times: string[];
  }>({
    goal: [],
    times: [],
    niche: NICHES[0],
    budget: '$250 to $500',
    start: 'This week',
  });
  const [wizError, setWizError] = useState('');

  // Research paper reader modal
  const [showPaper, setShowPaper] = useState(false);

  const getWaLink = (msg: string) => {
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  const handleCreatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = jn.trim();
    const handle = jh.trim();
    const whatsapp = jw.trim();
    const followers = parseInt(jfo, 10);

    if (!name || !handle || !whatsapp || isNaN(followers)) {
      setJm({ text: 'Fill in every field to continue.', err: true });
      return;
    }
    if (followers < 1000) {
      setJm({
        text: 'Campaign Zero needs 1,000+ followers on one platform. Come back when you’re there.',
        err: true,
      });
      return;
    }
    if (!jok) {
      setJm({
        text: 'Tick the box to confirm you understand Campaign Zero is unpaid.',
        err: true,
      });
      return;
    }

    setJm(null);

    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const newUid = `creator_${Date.now()}`;

    // Store in public and private database
    db.creatorsPublic[newUid] = {
      uid: newUid,
      handle: cleanHandle,
      platform: jp as any,
      niche: jni,
      followers,
      status: 'applied',
      createdAt: new Date().toISOString().split('T')[0],
    };

    db.creatorsPrivate[newUid] = {
      uid: newUid,
      name,
      whatsappNumber: whatsapp,
      ecoCashNumber: whatsapp,
    };

    const messageLines = [
      'Mhomho Media: Campaign Zero sign-up',
      `Name: ${name}`,
      `Handle: ${cleanHandle}`,
      `Platform: ${jp}`,
      `Followers: ${followers.toLocaleString('en-US')}`,
      `Niche: ${jni}`,
      `WhatsApp: ${whatsapp}`,
      'I understand Campaign Zero is unpaid.',
    ].join('\n');

    setOutMessage(messageLines);

    // Call success handler after small delay or let user view message
    setTimeout(() => {
      onCreatorApplySuccess(newUid);
    }, 2500);
  };

  const generateBriefText = () => {
    return [
      'Mhomho Media: campaign brief',
      `Business: ${wizData.biz || ''} (${wizData.niche || ''})`,
      `Promoting: ${wizData.promo || ''}`,
      `Goals: ${wizData.goal.join(', ')}`,
      `Budget: ${wizData.budget || ''}`,
      `Start: ${wizData.start || ''}`,
      `Notes: ${wizData.notes || 'None'}`,
      `From: ${wizData.name || ''}`,
      `Phone: ${wizData.phone || ''}`,
    ].join('\n');
  };

  const handleWizNext = () => {
    setWizError('');
    const currentStepConfig = WIZARD_STEPS[wizStep];

    if (currentStepConfig.t === 'text') {
      if (!wizData.promo || !wizData.promo.trim()) {
        setWizError('Answer this one to continue.');
        return;
      }
    } else if (currentStepConfig.t === 'many') {
      if (!wizData.goal || wizData.goal.length === 0) {
        setWizError('Answer this one to continue.');
        return;
      }
    } else if (currentStepConfig.t === 'who') {
      if (!wizData.biz?.trim() || !wizData.name?.trim() || !wizData.phone?.trim()) {
        setWizError('Add your business name, your name and a phone number.');
        return;
      }

      // Record to Firestore enquiries
      createEnquiry({
        bizName: wizData.biz.trim(),
        contactName: wizData.name.trim(),
        phone: wizData.phone.trim(),
        niche: wizData.niche || 'Tech & gadgets',
        promo: wizData.promo || '',
        goals: wizData.goal,
        budget: wizData.budget || '$250 to $500',
        start: wizData.start || 'This week',
        notes: wizData.notes,
        bestTimes: wizData.times,
      });
    }

    setWizStep((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-montserrat">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5 py-3 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 text-inherit no-underline">
            <svg viewBox="0 0 64 64" className="w-8 h-8" aria-hidden="true">
              <defs>
                <linearGradient id="nav-g" x1="0" x2="1">
                  <stop offset="0" stopColor="#FFA10A" />
                  <stop offset="1" stopColor="#F0191B" />
                </linearGradient>
              </defs>
              <circle cx="15" cy="13" r="6" fill="url(#nav-g)" />
              <circle cx="32" cy="8" r="7" fill="url(#nav-g)" />
              <circle cx="49" cy="13" r="6" fill="url(#nav-g)" />
              <polygon
                points="6,26 32,46 58,26 58,60 47,60 47,40 32,53 17,40 17,60 6,60"
                fill="url(#nav-g)"
              />
            </svg>
            <div>
              <b className="block font-extrabold text-[16px] tracking-[0.04em] leading-tight">MHOMHO</b>
              <span className="block text-[9px] tracking-[0.42em] text-[var(--muted)]">MEDIA</span>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenSignIn}
              className="text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onOpenPortal('creator', 'tendai_uid')}
              className="px-3.5 py-1.5 rounded-[8px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[12px] cursor-pointer"
            >
              App Portal
            </button>
          </div>
        </div>
      </nav>

      {/* Header / Hero */}
      <header className="max-w-[720px] mx-auto px-5 pt-8 pb-4">
        <div className="brand flex items-center gap-3 py-4">
          <svg viewBox="0 0 64 64" className="w-11 h-11" aria-hidden="true">
            <defs>
              <linearGradient id="hero-g" x1="0" x2="1">
                <stop offset="0" stopColor="#FFA10A" />
                <stop offset="1" stopColor="#F0191B" />
              </linearGradient>
            </defs>
            <circle cx="15" cy="13" r="6" fill="url(#hero-g)" />
            <circle cx="32" cy="8" r="7" fill="url(#hero-g)" />
            <circle cx="49" cy="13" r="6" fill="url(#hero-g)" />
            <polygon
              points="6,26 32,46 58,26 58,60 47,60 47,40 32,53 17,40 17,60 6,60"
              fill="url(#hero-g)"
            />
          </svg>
          <div>
            <b className="block font-extrabold text-[19px] tracking-[0.04em] leading-tight">MHOMHO</b>
            <span className="block text-[11px] tracking-[0.42em] text-[var(--muted)]">MEDIA</span>
          </div>
        </div>

        <h1 className="font-extrabold text-[38px] sm:text-[56px] leading-[1.02] tracking-[-0.02em] mt-6 mb-4">
          Activate your own crowd.
        </h1>
        <p className="text-[18px] text-[var(--muted)] leading-[1.6] max-w-[56ch] mb-6">
          Most Zimbabwean brands buy influence the same way: pay a comedian for a post and hope. No views promised, no click-through rate, no data afterwards. That’s spray and pray. Mhomho puts your message in front of hundreds of creators your buyers already follow, and you pay for the views that were delivered.
        </p>

        <div className="flex flex-wrap gap-2.5 mt-5 mb-6">
          <a
            href="#brands"
            className="flex-1 min-w-[200px] min-h-[52px] px-6 rounded-[10px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[16px] flex items-center justify-center no-underline text-center cursor-pointer"
          >
            Run a campaign
          </a>
          <a
            href="#creators"
            className="flex-1 min-w-[200px] min-h-[52px] px-6 rounded-[10px] border border-[var(--line)] bg-transparent text-[var(--text)] font-semibold text-[16px] flex items-center justify-center no-underline text-center cursor-pointer"
          >
            Join as a creator
          </a>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-[14px] font-semibold">
          <span className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.5em] before:w-[9px] before:h-[9px] before:rounded-full before:bg-[var(--grad)]">
            Views verified post by post
          </span>
          <span className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.5em] before:w-[9px] before:h-[9px] before:rounded-full before:bg-[var(--grad)]">
            Audiences matched by niche
          </span>
          <span className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.5em] before:w-[9px] before:h-[9px] before:rounded-full before:bg-[var(--grad)]">
            You pay for what lands
          </span>
        </div>

        {/* 96 Animated Dots */}
        <div className="grid grid-cols-12 gap-[7px] my-10" aria-hidden="true">
          {Array.from({ length: 96 }).map((_, i) => (
            <i
              key={i}
              className="aspect-square rounded-full block"
              style={{
                background: 'linear-gradient(135deg, var(--a1), var(--a2))',
                opacity: i === 0 ? 1 : 0.2 + (i % 6) * 0.12,
              }}
            />
          ))}
        </div>
        <p className="text-[14px] text-[var(--muted)]">
          One post is a whisper. Hundreds of creators posting at once is a roar.
        </p>
      </header>

      {/* Section: Spray and pray isn't a strategy */}
      <section className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-4">
            Spray and pray isn’t a strategy.
          </h2>
          <p className="text-[18px] text-[var(--muted)] leading-[1.6] max-w-[56ch] mb-5">
            We asked 233 businesses what their influencer money bought. Most couldn’t say. Most influencers in Zimbabwe are comedians, and their audiences are huge and mixed: great for laughs, useless for targeting. So businesses end up paying for followers, not deliverables.
          </p>

          <ul className="list-none p-0 my-5 space-y-2.5">
            <li className="py-3.5 pl-4 border-l-[3px] border-[var(--a2)] font-semibold text-[15px]">
              You’re buying a follower count. Views and click-through rate never make it into the deal.
            </li>
            <li className="py-3.5 pl-4 border-l-[3px] border-[var(--a2)] font-semibold text-[15px]">
              There’s no tracking. Once the post is up, you get a screenshot, if that. No data means no learning.
            </li>
            <li className="py-3.5 pl-4 border-l-[3px] border-[var(--a2)] font-semibold text-[15px]">
              Your product becomes a prop. It sits in a skit where the joke is the point and your brand is the background.
            </li>
            <li className="py-3.5 pl-4 border-l-[3px] border-[var(--a2)] font-semibold text-[15px]">
              Prices follow fame, not results. A bigger name costs more, whether or not the right people are watching.
            </li>
          </ul>

          <p className="text-[24px] sm:text-[28px] font-extrabold leading-[1.2] mt-6">
            That’s a lottery ticket, not marketing.
          </p>
        </div>
      </section>

      {/* Section: How Mhomho works */}
      <section className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-6">
            How Mhomho works
          </h2>

          <div className="grid grid-cols-[42px_1fr] gap-3.5 my-5">
            <b className="grid place-items-center w-[42px] h-[42px] rounded-full bg-[var(--grad)] text-[var(--ink)] font-extrabold">
              1
            </b>
            <div>
              <h3 className="m-0 mb-1 text-[18px] font-extrabold">Tell us what you’re selling.</h3>
              <p className="m-0 text-[15px] text-[var(--muted)]">
                Answer a few questions about your business, your goal and your budget. No account to create.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[42px_1fr] gap-3.5 my-5">
            <b className="grid place-items-center w-[42px] h-[42px] rounded-full bg-[var(--grad)] text-[var(--ink)] font-extrabold">
              2
            </b>
            <div>
              <h3 className="m-0 mb-1 text-[18px] font-extrabold">Hundreds of creators in the right niche post it.</h3>
              <p className="m-0 text-[15px] text-[var(--muted)]">
                Tech buyers see tech creators. Beauty buyers see beauty creators. Every post lands in front of people who already follow that topic.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[42px_1fr] gap-3.5 my-5">
            <b className="grid place-items-center w-[42px] h-[42px] rounded-full bg-[var(--grad)] text-[var(--ink)] font-extrabold">
              3
            </b>
            <div>
              <h3 className="m-0 mb-1 text-[18px] font-extrabold">You pay for what lands.</h3>
              <p className="m-0 text-[15px] text-[var(--muted)]">
                A post only counts once it reaches 1,000 views. Every counted view is verified, and budget that isn’t delivered isn’t billed.
              </p>
            </div>
          </div>

          {/* Comparison table from HTML */}
          <div className="overflow-x-auto mt-8">
            <div className="grid grid-cols-[1fr_1.2fr_1.2fr] min-w-[520px] border border-[var(--line)] rounded-[12px] overflow-hidden text-[14px]">
              <div className="p-3.5 border-b border-[var(--line)] font-extrabold bg-[var(--bg)]"></div>
              <div className="p-3.5 border-b border-[var(--line)] font-extrabold bg-[var(--bg)] text-[var(--muted)]">
                Flat-fee influencer
              </div>
              <div className="p-3.5 border-b border-[var(--line)] font-extrabold bg-[var(--bg)]">
                Mhomho
              </div>

              <div className="p-3.5 border-b border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]">
                You pay for
              </div>
              <div className="p-3.5 border-b border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]">
                A famous name
              </div>
              <div className="p-3.5 border-b border-[var(--line)] font-semibold bg-[var(--surface)]">
                Views that were delivered
              </div>

              <div className="p-3.5 border-b border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]">
                Who sees it
              </div>
              <div className="p-3.5 border-b border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]">
                Whoever follows them
              </div>
              <div className="p-3.5 border-b border-[var(--line)] font-semibold bg-[var(--surface)]">
                People who follow creators for your category
              </div>

              <div className="p-3.5 border-b border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]">
                Proof
              </div>
              <div className="p-3.5 border-b border-[var(--line)] text-[var(--muted)] bg-[var(--surface)]">
                “Trust me”
              </div>
              <div className="p-3.5 border-b border-[var(--line)] font-semibold bg-[var(--surface)]">
                Verified view counts, post by post
              </div>

              <div className="p-3.5 text-[var(--muted)] bg-[var(--surface)]">
                A post flops
              </div>
              <div className="p-3.5 text-[var(--muted)] bg-[var(--surface)]">
                You’ve already paid
              </div>
              <div className="p-3.5 font-semibold bg-[var(--surface)]">
                It isn’t counted and you aren’t billed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: What a crowd does that one voice can't */}
      <section className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-4">
            What a crowd does that one voice can’t.
          </h2>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Repetition builds recall.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              People rarely act the first time they see something. Seeing it from five creators in one week is how a brand sticks.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Social proof.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              When different faces your audience already trusts back the same thing, it stops looking like an ad and starts looking like consensus.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Relevance.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              Each creator talks to their own niche in their own style, so your message lands as a recommendation, not a billboard.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Resilience.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              One creator can flop. Two hundred can’t all flop.
            </p>
          </div>

          <p className="text-[22px] sm:text-[26px] font-extrabold leading-[1.2] mt-6">
            Today, reach is something you rent from a celebrity. We’re making it something you can plan, measure and repeat.
          </p>
        </div>
      </section>

      {/* Section: AI reads the feed */}
      <section className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-3">
            AI reads the feed so creators don’t have to guess.
          </h2>
          <p className="text-[18px] text-[var(--muted)] leading-[1.6] max-w-[56ch] mb-4">
            We use AI to scan what’s taking off in Zimbabwe, across topics, sounds, hooks and formats, and break down why those videos work. People make the calls. AI does the reading.
          </p>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">A living library of formats.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              We study viral formats at scale, then turn them into briefs creators can use the same day.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">A read on every niche.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              What’s moving in tech this week isn’t what’s moving in beauty, so each niche gets its own trend report.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Coaching from real results.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              After each campaign, creators see which hooks and lengths earned their views, so the next post is better.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Smarter matching.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              Past results help us pick which creators fit which campaign.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Why this is hard to copy */}
      <section className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-4">
            Why this is hard to copy.
          </h2>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Creators earn their seat.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              Nobody joins by asking. Campaign Zero makes every creator prove a clip can reach 1,000 views before they touch a paid campaign. The roster is a track record, not a follower count.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Every campaign teaches us what works here.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              We log which niches and formats perform for Zimbabwean audiences. Over time that becomes a record you can’t buy, scrape or borrow from a foreign platform.
            </p>
          </div>

          <div className="py-4 border-b border-[var(--line)]">
            <h3 className="m-0 mb-1 text-[18px] font-extrabold">Built for how Zimbabwe actually runs.</h3>
            <p className="m-0 text-[15px] text-[var(--muted)]">
              Briefs on WhatsApp, payouts by EcoCash, budgets sized for local businesses. Not a global tool pointed at us.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Creators: Campaign Zero sign-up */}
      <section id="creators" className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-2">
            Creators: get paid for what you deliver.
          </h2>
          <p className="text-[18px] text-[var(--muted)] leading-[1.6] max-w-[56ch] mb-4">
            Join Campaign Zero. Post 3 clips of our content. If one reaches 1,000 views, you’re in the paid program, where creators earn $1.60 per 1,000 verified views.
          </p>

          <ul className="list-disc pl-5 text-[14px] text-[var(--muted)] space-y-1.5 mb-6">
            <li>You need 1,000+ followers on one platform.</li>
            <li>Campaign Zero is unpaid. The seat is the reward.</li>
            <li>Under 1,000 views earns $0. Past it, every view counts.</li>
            <li>No bought views. Clips stay live for 30 days.</li>
          </ul>

          <form
            onSubmit={handleCreatorSubmit}
            className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-5 mt-5"
          >
            <label className="block font-semibold text-[14px] mb-1.5">Full name</label>
            <input
              value={jn}
              onChange={(e) => setJn(e.target.value)}
              className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px] mb-4"
              placeholder="e.g. Tendai Moyo"
              required
            />

            <label className="block font-semibold text-[14px] mb-1.5">Your handle</label>
            <input
              value={jh}
              onChange={(e) => setJh(e.target.value)}
              className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px] mb-4"
              placeholder="@yourhandle"
              required
            />

            <label className="block font-semibold text-[14px] mb-1.5">Main platform</label>
            <select
              value={jp}
              onChange={(e) => setJp(e.target.value)}
              className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px] mb-4"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <label className="block font-semibold text-[14px] mb-1.5">Followers on that platform</label>
            <input
              type="number"
              min="1000"
              value={jfo}
              onChange={(e) => setJfo(e.target.value)}
              className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px] mb-4"
              placeholder="e.g. 2500"
              required
            />

            <label className="block font-semibold text-[14px] mb-1.5">Your niche</label>
            <select
              value={jni}
              onChange={(e) => setJni(e.target.value)}
              className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px] mb-4"
            >
              {NICHES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>

            <label className="block font-semibold text-[14px] mb-1.5">WhatsApp number</label>
            <input
              type="tel"
              value={jw}
              onChange={(e) => setJw(e.target.value)}
              className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px] mb-4"
              placeholder="+263 77 000 0000"
              required
            />

            <div className="flex gap-3 items-start mt-4 mb-3 text-[14px]">
              <input
                type="checkbox"
                id="jok"
                checked={jok}
                onChange={(e) => setJok(e.target.checked)}
                className="w-[22px] min-h-[22px] mt-0.5 accent-[var(--a2)]"
              />
              <label htmlFor="jok" className="font-normal cursor-pointer leading-[1.4]">
                I understand Campaign Zero is unpaid. My reward is a place in the paid program if one clip reaches 1,000 views.
              </label>
            </div>

            {jm && (
              <p className={`min-h-[22px] my-3 text-[14px] font-semibold ${jm.err ? 'text-[var(--err)]' : 'text-[var(--ok)]'}`}>
                {jm.text}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[52px] rounded-[10px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[16px] cursor-pointer"
            >
              Get my sign-up message
            </button>
          </form>

          {/* Generated ready message */}
          {outMessage && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-5 mt-5">
              <div className="text-[20px] font-extrabold mb-1">Your message is ready</div>
              <p className="text-[14px] text-[var(--muted)] mb-3">
                Tap send in WhatsApp. For a clip, attach an analytics screenshot too.
              </p>
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] bg-[var(--bg)] p-3 rounded-[8px] border border-[var(--line)] mb-3.5">
                {outMessage}
              </pre>
              <a
                href={getWaLink(outMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[52px] rounded-[10px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[16px] flex items-center justify-center no-underline cursor-pointer"
              >
                Send on WhatsApp
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Section: Brands Wizard */}
      <section id="brands" className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-2">
            Brands: tell us what you need.
          </h2>
          <p className="text-[18px] text-[var(--muted)] leading-[1.6] max-w-[56ch] mb-5">
            No sign-up. Answer a few questions and leave a phone number, then book a call or message us on WhatsApp.
          </p>

          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-5 mt-5">
            {wizStep < WIZARD_STEPS.length ? (
              <div>
                {/* Progress bar */}
                <div className="h-1 bg-[var(--line)] rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-[var(--grad)] rounded-full transition-all"
                    style={{ width: `${((wizStep + 1) / WIZARD_STEPS.length) * 100}%` }}
                  />
                </div>

                <div className="text-[20px] font-extrabold mb-3.5 leading-[1.25]">
                  {WIZARD_STEPS[wizStep].q}
                </div>

                {WIZARD_STEPS[wizStep].t === 'text' && (
                  <input
                    value={wizData.promo || ''}
                    onChange={(e) => setWizData({ ...wizData, promo: e.target.value })}
                    placeholder={WIZARD_STEPS[wizStep].ph}
                    className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px]"
                  />
                )}

                {WIZARD_STEPS[wizStep].t === 'one' && WIZARD_STEPS[wizStep].o && (
                  <div className="flex flex-wrap gap-2">
                    {WIZARD_STEPS[wizStep].o!.map((opt) => {
                      const isSel = (wizData as any)[WIZARD_STEPS[wizStep].k] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setWizData({ ...wizData, [WIZARD_STEPS[wizStep].k]: opt })}
                          className={`min-h-[46px] px-4 py-2.5 rounded-full border text-[14px] font-semibold cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-[var(--grad)] text-[var(--ink)] border-transparent'
                              : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)]'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {WIZARD_STEPS[wizStep].t === 'many' && WIZARD_STEPS[wizStep].o && (
                  <div className="flex flex-wrap gap-2">
                    {WIZARD_STEPS[wizStep].o!.map((opt) => {
                      const isSel = wizData.goal.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const exists = wizData.goal.includes(opt);
                            setWizData({
                              ...wizData,
                              goal: exists ? wizData.goal.filter((g) => g !== opt) : [...wizData.goal, opt],
                            });
                          }}
                          className={`min-h-[46px] px-4 py-2.5 rounded-full border text-[14px] font-semibold cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-[var(--grad)] text-[var(--ink)] border-transparent'
                              : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)]'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {WIZARD_STEPS[wizStep].t === 'who' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold text-[14px] mb-1">Business name</label>
                      <input
                        value={wizData.biz || ''}
                        onChange={(e) => setWizData({ ...wizData, biz: e.target.value })}
                        className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[14px] mb-1">Your name</label>
                      <input
                        value={wizData.name || ''}
                        onChange={(e) => setWizData({ ...wizData, name: e.target.value })}
                        className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[14px] mb-1">Phone number</label>
                      <input
                        type="tel"
                        value={wizData.phone || ''}
                        onChange={(e) => setWizData({ ...wizData, phone: e.target.value })}
                        className="w-full min-h-[50px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[14px] mb-1">Anything else we should know? (optional)</label>
                      <textarea
                        value={wizData.notes || ''}
                        onChange={(e) => setWizData({ ...wizData, notes: e.target.value })}
                        className="w-full min-h-[96px] p-3 border border-[var(--line)] rounded-[10px] bg-[var(--surface)] text-[var(--text)] text-[16px] resize-y"
                      />
                    </div>
                  </div>
                )}

                {wizError && (
                  <p className="min-h-[22px] my-3 text-[14px] font-semibold text-[var(--err)]">
                    {wizError}
                  </p>
                )}

                <div className="flex gap-2.5 mt-5">
                  {wizStep > 0 && (
                    <button
                      type="button"
                      onClick={() => setWizStep(wizStep - 1)}
                      className="flex-1 min-h-[52px] rounded-[10px] border border-[var(--line)] bg-transparent text-[var(--text)] font-semibold text-[16px] cursor-pointer"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleWizNext}
                    className="flex-1 min-h-[52px] rounded-[10px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[16px] cursor-pointer"
                  >
                    {wizStep === WIZARD_STEPS.length - 1 ? 'See my brief' : 'Next'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[20px] font-extrabold mb-3 leading-[1.25]">
                  Here’s your brief
                </div>

                <dl className="mb-4 text-[14px] space-y-2">
                  <div>
                    <dt className="text-[var(--muted)]">Promoting</dt>
                    <dd className="font-semibold m-0">{wizData.promo}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Business</dt>
                    <dd className="font-semibold m-0">{wizData.biz} ({wizData.niche})</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Goals</dt>
                    <dd className="font-semibold m-0">{wizData.goal.join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Budget</dt>
                    <dd className="font-semibold m-0">{wizData.budget}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Start</dt>
                    <dd className="font-semibold m-0">{wizData.start}</dd>
                  </div>
                </dl>

                <p className="text-[14px] text-[var(--muted)] mb-2">Best time for a call? Pick any.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['Morning', 'Afternoon', 'Evening', 'Weekend'].map((t) => {
                    const isSel = wizData.times.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const exists = wizData.times.includes(t);
                          setWizData({
                            ...wizData,
                            times: exists ? wizData.times.filter((x) => x !== t) : [...wizData.times, t],
                          });
                        }}
                        className={`min-h-[46px] px-4 py-2.5 rounded-full border text-[14px] font-semibold cursor-pointer ${
                          isSel
                            ? 'bg-[var(--grad)] text-[var(--ink)] border-transparent'
                            : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)]'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2.5 mt-5">
                  <a
                    href={getWaLink(
                      `Hi Mhomho, I’d like to book a call.${
                        wizData.times.length ? ` Best time: ${wizData.times.join(', ')}.` : ''
                      }\n\n${generateBriefText()}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[200px] min-h-[52px] rounded-[10px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[16px] flex items-center justify-center no-underline cursor-pointer"
                  >
                    Book a call
                  </a>
                  <a
                    href={getWaLink(generateBriefText())}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[200px] min-h-[52px] rounded-[10px] border border-[var(--line)] bg-transparent text-[var(--text)] font-semibold text-[16px] flex items-center justify-center no-underline cursor-pointer"
                  >
                    WhatsApp us
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setWizStep(0);
                    setWizData({ goal: [], times: [], niche: NICHES[0], budget: '$250 to $500', start: 'This week' });
                  }}
                  className="w-full mt-3 py-2 text-[14px] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section: Read the research */}
      <section className="py-14 border-t border-[var(--line)]">
        <div className="max-w-[720px] mx-auto px-5">
          <h2 className="font-extrabold text-[26px] sm:text-[34px] leading-[1.12] tracking-[-0.01em] mb-4">
            Read the research.
          </h2>
          <div className="border border-[var(--line)] rounded-[14px] p-6 bg-[var(--surface)]">
            <h3 className="m-0 text-[22px] font-extrabold leading-[1.2] mb-2">
              Rethinking Influencer Distribution in Zimbabwe
            </h3>
            <p className="text-[15px] text-[var(--muted)] mb-5">
              Why flat-fee influencer deals fail, what the clipping economy proves about many voices beating one, and the model behind Mhomho. Market numbers included.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    const bin = atob(PDF_B64);
                    const u = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
                    const blob = new Blob([u], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Mhomho_Media_Research_Paper.pdf';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    window.open(getWaLink('Hi Mhomho, please send me the research paper.'), '_blank');
                  }
                }}
                className="min-h-[52px] px-6 rounded-[10px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[15px] cursor-pointer"
              >
                Download the paper (PDF)
              </button>
              <button
                type="button"
                onClick={() => setShowPaper(true)}
                className="min-h-[52px] px-6 rounded-[10px] border border-[var(--line)] bg-transparent text-[var(--text)] font-semibold text-[15px] cursor-pointer hover:bg-[var(--surface)]"
              >
                Read in App
              </button>
              <a
                href={getWaLink('Hi Mhomho, please send me the research paper.')}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[52px] px-6 rounded-[10px] border border-[var(--line)] bg-transparent text-[var(--text)] font-semibold text-[15px] flex items-center justify-center no-underline cursor-pointer hover:bg-[var(--surface)]"
              >
                Request on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 pb-16 border-t border-[var(--line)] text-[14px] text-[var(--muted)]">
        <div className="max-w-[720px] mx-auto px-5 leading-[1.6]">
          Mhomho is Shona for a crowd. One message, a thousand voices.<br />
          Mhomho Media, Zimbabwe.<br />
          <a
            href={`https://wa.me/${WA_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-inherit hover:underline"
          >
            WhatsApp +263 78 620 5197
          </a>
        </div>
      </footer>

      {/* Research Paper Modal */}
      {showPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-[680px] max-h-[85vh] flex flex-col bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[19px] font-extrabold m-0">
                Rethinking Influencer Distribution in Zimbabwe
              </h3>
              <button
                type="button"
                onClick={() => setShowPaper(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] text-[22px] font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto text-[14px] text-[var(--muted)] space-y-3.5 pr-2 leading-[1.6]">
              <p className="font-semibold text-[var(--text)]">
                Author: Bezil Sire · Mhomho Media Research Paper
              </p>
              <p>
                <strong>1. The Problem with Zimbabwean Influencer Deals:</strong> Most brands pay popular comedians a flat fee ($150 to $500+) for a skit. The joke is funny, but the audience is mixed and untargeted. Once posted, no views are guaranteed and no conversion tracking exists.
              </p>
              <p>
                <strong>2. The Clipping Revolution:</strong> Modern social algorithms prioritize content relevance. Hundreds of category-specific creators (tech enthusiasts, beauty vloggers, fitness coaches) collectively generate far higher organic recall and targeted conversions than a single comedian’s post.
              </p>
              <p>
                <strong>3. The Mhomho Performance Guarantee:</strong> Brands buy verified views at $1.50 per 1,000 views. Budget is only consumed as views land and are verified. If a post flops, the brand isn’t billed.
              </p>
              <p>
                <strong>4. Creator Economy in Zimbabwe:</strong> Creators are paid $1.00 per 1,000 verified views once reaching 1,000 views per post, with payouts sent directly to EcoCash accounts 72 hours after campaign close.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line)] flex justify-end">
              <button
                type="button"
                onClick={() => setShowPaper(false)}
                className="px-5 py-2.5 rounded-[10px] bg-[var(--grad)] text-[var(--ink)] font-extrabold text-[14px] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
